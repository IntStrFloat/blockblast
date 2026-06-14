import { create } from 'zustand';

import { createGame, deserialize, place, revive, seedFromTime, serialize } from '@/core/engine';
import type { GameState, PlacementEvent } from '@/core/engine';
import { KEYS, getString, removeKey, setString } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';
import { useLeaderboardStore } from '@/features/leaderboard/store';
import { useScores } from '@/features/scores';
import type { SubmitResult } from '@/features/scores';
import { useStreak } from '@/features/streak';

export interface NewGameOptions {
  seed?: number;
  mode?: 'weekly' | 'daily';
  challengeDate?: string | null;
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

interface GameStore {
  game: GameState;
  lastEvent: PlacementEvent | null;
  linesCleared: number;
  finalResult: SubmitResult | null;
  runBestAtStart: number;
  recordCelebration: RecordCelebration | null;
  recordCelebrated: boolean;
  newGame: (options?: NewGameOptions) => void;
  discardAndStartNew: (options?: NewGameOptions) => void;
  placePiece: (trayIndex: number, r: number, c: number) => PlacementEvent | null;
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

  if (score > previous.runBestAtStart) {
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
  const startNew = (options?: NewGameOptions) => {
    const best = useScores.getState().best;
    const proof = useLeaderboardStore.getState().startRun({
      startedAt: new Date().toISOString(),
      mode: options?.mode ?? 'weekly',
      seed: options?.seed ?? seedFromTime(),
      challengeDate: options?.challengeDate ?? null,
    });
    const game = createGame(proof.seed);
    set({
      game,
      lastEvent: null,
      linesCleared: 0,
      finalResult: null,
      ...buildFreshPresentationState(best),
    });
    setString(KEYS.gameCurrent, serialize(game));
    useAnalyticsStore
      .getState()
      .track('game_start', { mode: options?.mode === 'daily' ? 'daily' : 'weekly' });
  };

  return {
    game: createGame(),
    lastEvent: null,
    linesCleared: 0,
    finalResult: null,
    ...buildFreshPresentationState(useScores.getState().best),

    newGame: startNew,
    discardAndStartNew: startNew,

    placePiece: (trayIndex, r, c) => {
      const { game, linesCleared } = get();
      let result: { state: GameState; event: PlacementEvent };
      try {
        result = place(game, trayIndex, r, c);
      } catch {
        return null;
      }

      const presentation = buildPlacementPresentationState(get(), result.event.score);
      const lines =
        linesCleared + result.event.clearedRows.length + result.event.clearedCols.length;
      useLeaderboardStore.getState().recordMove({ trayIndex, row: r, col: c });
      setString(KEYS.gameCurrent, serialize(result.state));

      if (result.event.gameOver) {
        const firstCompletion = !game.reviveUsed;
        const final = firstCompletion
          ? useScores.getState().submitGame(result.event.score, lines)
          : useScores.getState().improveBest(result.event.score);

        if (firstCompletion) {
          void useLeaderboardStore.getState().finishActiveRun(result.event.score, new Date());
          useStreak.getState().markPlayedToday();
        }

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

    continueGame: () => {
      const next = revive(get().game);
      if (!next) return false;
      set({ game: next, finalResult: null, lastEvent: null, linesCleared: 0 });
      setString(KEYS.gameCurrent, serialize(next));
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
        game,
        lastEvent: null,
        linesCleared: 0,
        finalResult: null,
        ...buildLoadedPresentationState(useScores.getState().best, game.score),
      });
      return game.status === 'playing' ? 'active' : 'terminal';
    },
  };
});
