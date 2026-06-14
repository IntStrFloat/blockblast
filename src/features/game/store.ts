import { create } from 'zustand';

import {
  createGame,
  deserialize,
  place,
  replaceTrayPiece as engineReplaceTrayPiece,
  revive,
  seedFromTime,
  serialize,
} from '@/core/engine';
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

interface GameStore {
  game: GameState;
  lastEvent: PlacementEvent | null;
  linesCleared: number;
  finalResult: SubmitResult | null;
  /**
   * Монотонно растущий счётчик партий. Увеличивается при newGame()/discardAndStartNew()
   * и loadSaved() (начало новой сессии игры). НЕ увеличивается при continueGame() (revive).
   * Используется маскотом для детекции «новая партия началась → если был потерян, вернуться».
   */
  epoch: number;
  newGame: (options?: NewGameOptions) => void;
  discardAndStartNew: (options?: NewGameOptions) => void;
  placePiece: (trayIndex: number, r: number, c: number) => PlacementEvent | null;
  /**
   * Заменить фигуру в слоте трея на свежую (помощник «свап» маскота).
   * No-op, если партия не идёт, индекс вне диапазона или слот пуст.
   * Автосейвит, как placePiece.
   */
  replaceTrayPiece: (trayIndex: number) => void;
  /** Восстановить снимок партии (undo свопа). Автосейвит. */
  restoreGame: (snapshot: GameState) => void;
  continueGame: () => boolean;
  loadSaved: () => Exclude<ResumeKind, 'none'> | null;
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
    const proof = useLeaderboardStore.getState().startRun({
      startedAt: new Date().toISOString(),
      mode: options?.mode ?? 'weekly',
      seed: options?.seed ?? seedFromTime(),
      challengeDate: options?.challengeDate ?? null,
    });
    const game = createGame(proof.seed);
    set({ game, lastEvent: null, linesCleared: 0, finalResult: null, epoch: get().epoch + 1 });
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
    epoch: 1,

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
        });
      } else {
        set({ game: result.state, lastEvent: result.event, linesCleared: lines });
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
      set({ game: snapshot });
      setString(KEYS.gameCurrent, serialize(snapshot));
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

      set({ game, lastEvent: null, linesCleared: 0, finalResult: null, epoch: get().epoch + 1 });
      return game.status === 'playing' ? 'active' : 'terminal';
    },
  };
});
