import { create } from 'zustand';

import {
  DEFAULT_CONFIG,
  configForExperience,
  createAdventureRun,
  createGame,
  deserialize,
  deserializeAdventureRun,
  placeAdventure,
  place,
  replaceTrayPiece as engineReplaceTrayPiece,
  revive,
  seedFromTime,
  serializeAdventureRun,
  serialize,
} from '@/core/engine';
import type {
  AdventureLevelSpec,
  AdventurePlacementEvent,
  AdventureRun,
  GameConfig,
  GameState,
  PlacementEvent,
} from '@/core/engine';
import { KEYS, getString, removeKey, setString } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';
import { useLeaderboardStore } from '@/features/leaderboard/store';
import { recordMeaningfulSessionForPush } from '@/features/notifications/softAsk';
import { useFtueStore } from '@/features/onboarding/ftueStore';
import {
  findTutorialRecommendation,
  withTutorialRecoveryPiece,
} from '@/features/onboarding/tutorialGame';
import { useScores } from '@/features/scores';
import type { SubmitResult } from '@/features/scores';
import { useSettings } from '@/features/settings';
import { useStreak } from '@/features/streak';

import { recordProgressFor } from './animation/recordProgression';
import { playPlacementFeedback } from './sound/feedback';

export interface NewGameOptions {
  seed?: number;
  /** Optional deterministic fixture used by the first-install tutorial only. */
  initialGame?: GameState;
}

export type ResumeKind = 'none' | 'active' | 'terminal';

export interface SavedGameSummary {
  kind: ResumeKind;
  score: number | null;
  canContinue: boolean;
}

export interface RecordCelebration {
  score: number;
  previousBest: number;
}

/** Config the классической партии дилит трей с FTUE-ассистом для новичков. */
function classicConfigFor(): GameConfig {
  return configForExperience(useScores.getState().gamesPlayed);
}

interface GameStore {
  game: GameState;
  /** Активный конфиг текущей классической партии (FTUE-ассист новичкам). */
  activeConfig: GameConfig;
  adventure: AdventureRun | null;
  lastEvent: PlacementEvent | null;
  lastAdventureEvent: AdventurePlacementEvent | null;
  linesCleared: number;
  finalResult: SubmitResult | null;
  epoch: number;
  runBestAtStart: number;
  recordCelebration: RecordCelebration | null;
  recordCelebrated: boolean;
  newGame: (options?: NewGameOptions) => void;
  newAdventureGame: (spec: AdventureLevelSpec, attempt?: number) => void;
  resumeSavedAdventure: (spec: AdventureLevelSpec) => AdventureRun | null;
  suspendAdventure: () => void;
  exitAdventure: () => void;
  discardAndStartNew: (options?: NewGameOptions) => void;
  placePiece: (trayIndex: number, r: number, c: number) => PlacementEvent | null;
  replaceTrayPiece: (trayIndex: number) => void;
  restoreGame: (snapshot: GameState) => void;
  continueGame: () => boolean;
  loadSaved: () => Exclude<ResumeKind, 'none'> | null;
}

function buildFreshPresentationState(best: number): Pick<
  GameStore,
  'runBestAtStart' | 'recordCelebration' | 'recordCelebrated'
> {
  return {
    runBestAtStart: best,
    recordCelebration: null,
    recordCelebrated: false,
  };
}

function buildLoadedPresentationState(
  best: number,
  score: number,
): Pick<GameStore, 'runBestAtStart' | 'recordCelebration' | 'recordCelebrated'> {
  return {
    runBestAtStart: best,
    recordCelebration: null,
    recordCelebrated: score > best,
  };
}

function buildPlacementPresentationState(
  previous: Pick<GameStore, 'runBestAtStart' | 'recordCelebration' | 'recordCelebrated'>,
  score: number,
): Pick<GameStore, 'recordCelebration' | 'recordCelebrated'> {
  if (previous.recordCelebration || previous.recordCelebrated) {
    return {
      recordCelebration: previous.recordCelebration,
      recordCelebrated: previous.recordCelebrated,
    };
  }

  if (previous.runBestAtStart > 0 && score > previous.runBestAtStart) {
    return {
      recordCelebration: {
        score,
        previousBest: previous.runBestAtStart,
      },
      recordCelebrated: false,
    };
  }

  return {
    recordCelebration: null,
    recordCelebrated: false,
  };
}

export function getSavedGameSummary(): SavedGameSummary {
  const raw = getString(KEYS.gameCurrent);
  if (!raw) return { kind: 'none', score: null, canContinue: false };

  const game = deserialize(raw);
  if (!game) {
    removeKey(KEYS.gameCurrent);
    return { kind: 'none', score: null, canContinue: false };
  }

  if (game.status === 'playing') {
    return { kind: 'active', score: game.score, canContinue: true };
  }
  return {
    kind: 'terminal',
    score: game.score,
    canContinue: !game.reviveUsed,
  };
}

export function hasSavedGame(): boolean {
  return getSavedGameSummary().kind !== 'none';
}

export function getSavedScore(): number | null {
  const summary = getSavedGameSummary();
  return summary.canContinue ? summary.score : null;
}

export const useGameStore = create<GameStore>((set, get) => {
  const clearAdventure = () => {
    removeKey(KEYS.adventureRun);
    return { adventure: null, lastAdventureEvent: null };
  };

  // Убирает adventure-ран из памяти, не трогая сохранённый снапшот в MMKV:
  // Endless-партия перестаёт роутиться в adventure-ветку placePiece, а уровень
  // можно восстановить позже через resumeSavedAdventure (FR-7).
  const detachAdventure = () => ({ adventure: null, lastAdventureEvent: null });

  const startNew = (options?: NewGameOptions) => {
    const best = useScores.getState().best;
    const proof = useLeaderboardStore.getState().startRun({
      startedAt: new Date().toISOString(),
      mode: 'weekly',
      seed: options?.seed ?? seedFromTime(),
      challengeDate: null,
    });
    const config = classicConfigFor();
    const game = options?.initialGame ?? createGame(proof.seed, config);
    set({
      ...clearAdventure(),
      game,
      activeConfig: config,
      lastEvent: null,
      linesCleared: 0,
      finalResult: null,
      epoch: get().epoch + 1,
      ...buildFreshPresentationState(best),
    });
    setString(KEYS.gameCurrent, serialize(game));
    useAnalyticsStore.getState().track('game_start', { mode: 'weekly' });
  };

  const placeAdventurePiece = (
    adventure: AdventureRun,
    trayIndex: number,
    r: number,
    c: number,
  ): AdventurePlacementEvent | null => {
    let adventureResult: { run: AdventureRun; event: AdventurePlacementEvent };
    try {
      adventureResult = placeAdventure(adventure, trayIndex, r, c);
    } catch {
      return null;
    }

    const settings = useSettings.getState();
    playPlacementFeedback(adventureResult.event, {
      sound: settings.sound,
      haptics: settings.haptics,
    });

    setString(KEYS.adventureRun, serializeAdventureRun(adventureResult.run));
    set({
      adventure: adventureResult.run,
      game: adventureResult.run.game,
      lastEvent: adventureResult.event,
      lastAdventureEvent: adventureResult.event,
      linesCleared:
        get().linesCleared +
        adventureResult.event.clearedRows.length +
        adventureResult.event.clearedCols.length,
    });
    return adventureResult.event;
  };

  return {
    game: createGame(),
    activeConfig: DEFAULT_CONFIG,
    adventure: null,
    lastEvent: null,
    lastAdventureEvent: null,
    linesCleared: 0,
    finalResult: null,
    epoch: 1,
    ...buildFreshPresentationState(useScores.getState().best),

    newGame: startNew,
    discardAndStartNew: startNew,

    newAdventureGame: (spec, attempt = 0) => {
      const run = createAdventureRun(spec, attempt);
      set({
        game: run.game,
        adventure: run,
        lastEvent: null,
        lastAdventureEvent: null,
        linesCleared: 0,
        finalResult: null,
        epoch: get().epoch + 1,
      });
      setString(KEYS.adventureRun, serializeAdventureRun(run));
      useAnalyticsStore.getState().track('adventure_level_start', {
        seasonId: spec.seasonId,
        levelIndex: spec.levelIndex,
        attempt,
        objective: spec.objective.type,
      });
    },

    resumeSavedAdventure: (spec) => {
      const raw = getString(KEYS.adventureRun);
      if (!raw) return null;

      const run = deserializeAdventureRun(raw);
      const matchesSpec =
        run !== null &&
        run.status === 'playing' &&
        run.level.seasonId === spec.seasonId &&
        run.level.levelIndex === spec.levelIndex &&
        run.level.objective.type === spec.objective.type &&
        run.level.objective.target === spec.objective.target;
      if (!matchesSpec) {
        removeKey(KEYS.adventureRun);
        return null;
      }

      set({
        game: run.game,
        adventure: run,
        lastEvent: null,
        lastAdventureEvent: null,
        linesCleared: 0,
        finalResult: null,
        epoch: get().epoch + 1,
      });
      return run;
    },

    suspendAdventure: () => {
      if (!get().adventure) return;
      set({ ...detachAdventure(), lastEvent: null });
    },

    exitAdventure: () => {
      set({
        ...clearAdventure(),
        game: createGame(),
        activeConfig: DEFAULT_CONFIG,
        lastEvent: null,
        linesCleared: 0,
        finalResult: null,
        epoch: get().epoch + 1,
      });
    },

    placePiece: (trayIndex, r, c) => {
      const adventure = get().adventure;
      if (adventure) {
        return placeAdventurePiece(adventure, trayIndex, r, c);
      }

      const { game, linesCleared, activeConfig, runBestAtStart } = get();
      let result: { state: GameState; event: PlacementEvent };
      try {
        result = place(game, trayIndex, r, c, activeConfig);
      } catch {
        return null;
      }

      const ftueStatus = useFtueStore.getState().status;
      if (
        ftueStatus === 'clear_line' &&
        result.state.status === 'playing' &&
        findTutorialRecommendation(result.state) === null
      ) {
        const recovery = withTutorialRecoveryPiece(result.state.board, result.state.tray);
        if (recovery) result = { ...result, state: { ...result.state, tray: recovery.tray } };
      }

      const settings = useSettings.getState();
      playPlacementFeedback(result.event, {
        sound: settings.sound,
        haptics: settings.haptics,
      });

      const presentation = buildPlacementPresentationState(get(), result.event.score);
      const previousRecordProgress = recordProgressFor(
        game.score,
        runBestAtStart,
        game.score,
      );
      const nextRecordProgress = recordProgressFor(
        result.event.score,
        runBestAtStart,
        game.score,
      );
      const analyticsRecordStage =
        nextRecordProgress.stage === 'record_broken'
          ? 'broken'
          : nextRecordProgress.stage === 'pursuit' || nextRecordProgress.stage === 'near'
            ? nextRecordProgress.stage
            : null;
      if (
        nextRecordProgress.stage !== previousRecordProgress.stage &&
        analyticsRecordStage
      ) {
        useAnalyticsStore.getState().track('record_progressed', {
          stage: analyticsRecordStage,
          score: result.event.score,
          best_at_start: runBestAtStart,
          game_depth: useScores.getState().gamesPlayed + 1,
        });
      }
      const lines =
        linesCleared + result.event.clearedRows.length + result.event.clearedCols.length;
      const clearedNow = result.event.clearedRows.length + result.event.clearedCols.length > 0;
      useLeaderboardStore.getState().recordMove({ trayIndex, row: r, col: c });
      setString(KEYS.gameCurrent, serialize(result.state));

      if (clearedNow) {
        useStreak.getState().markPlayedToday();
        const sessionId = useAnalyticsStore.getState().context?.session_id;
        if (sessionId) recordMeaningfulSessionForPush(sessionId);
      }

      if (result.event.gameOver) {
        const firstCompletion = !game.reviveUsed;
        const final = firstCompletion
          ? useScores.getState().submitGame(result.event.score, lines)
          : useScores.getState().improveBest(result.event.score);
        const sessionDepth = useScores.getState().gamesPlayed;

        // Лидерборд финализируем при КАЖДОМ game-over: первый раз — обычный
        // (ranked) финал; после ревайва ран переоткрыт reopenActiveRun() в
        // continueGame, поэтому финализируется снова и поднимает локальный
        // недельный результат финальным счётом (см. баг «лидерборд после рекламы»).
        void useLeaderboardStore.getState().finishActiveRun(result.event.score, new Date());

        useAnalyticsStore.getState().track('game_over', {
          score: result.event.score,
          linesCleared: lines,
          revived: game.reviveUsed,
          sessionDepth,
        });
        useAnalyticsStore.getState().track('session_depth', { gamesPlayed: sessionDepth });

        set({
          game: result.state,
          lastEvent: result.event,
          linesCleared: 0,
          finalResult: final,
          ...presentation,
        });
      } else {
        set({
          game: result.state,
          lastEvent: result.event,
          linesCleared: lines,
          ...presentation,
        });
      }

      return result.event;
    },

    replaceTrayPiece: (trayIndex) => {
      const { game } = get();
      if (game.status !== 'playing') return;
      if (trayIndex < 0 || trayIndex >= game.tray.length) return;
      if (game.tray[trayIndex] === null) return;
      const next = engineReplaceTrayPiece(game, trayIndex);
      set({ game: next });
      setString(KEYS.gameCurrent, serialize(next));
    },

    restoreGame: (snapshot) => {
      set({ ...detachAdventure(), game: snapshot });
      setString(KEYS.gameCurrent, serialize(snapshot));
    },

    continueGame: () => {
      const next = revive(get().game);
      if (!next) return false;
      // Переоткрываем ран лидерборда, чтобы продолженная партия дописывала ходы
      // и финализировалась заново — иначе счёт после ревайва не попадал в результат.
      useLeaderboardStore.getState().reopenActiveRun();
      set({ game: next, finalResult: null, lastEvent: null, linesCleared: 0 });
      setString(KEYS.gameCurrent, serialize(next));
      useAnalyticsStore.getState().track('revive_used', { result: 'continued' });
      return true;
    },

    loadSaved: () => {
      const raw = getString(KEYS.gameCurrent);
      if (!raw) return null;

      const game = deserialize(raw);
      if (!game) {
        removeKey(KEYS.gameCurrent);
        return null;
      }

      set({
        ...detachAdventure(),
        game,
        activeConfig: configForExperience(useScores.getState().gamesPlayed),
        lastEvent: null,
        linesCleared: 0,
        finalResult: null,
        epoch: get().epoch + 1,
        ...buildLoadedPresentationState(useScores.getState().best, game.score),
      });
      return game.status === 'playing' ? 'active' : 'terminal';
    },
  };
});
