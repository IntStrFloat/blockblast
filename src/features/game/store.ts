import { create } from 'zustand';

import { createGame, deserialize, place, revive, seedFromTime, serialize } from '@/core/engine';
import type { GameState, PlacementEvent } from '@/core/engine';
import { KEYS, getString, removeKey, setString } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';
import { useLeaderboardStore } from '@/features/leaderboard/store';
import { useScores } from '@/features/scores';
import type { SubmitResult } from '@/features/scores';
import { useStreak } from '@/features/streak';

interface NewGameOptions {
  seed?: number;
  mode?: 'weekly' | 'daily';
  challengeDate?: string | null;
}

interface GameStore {
  game: GameState;
  lastEvent: PlacementEvent | null;
  linesCleared: number;
  finalResult: SubmitResult | null;
  newGame: (options?: NewGameOptions) => void;
  placePiece: (trayIndex: number, r: number, c: number) => PlacementEvent | null;
  reviveGame: () => void;
  loadSaved: () => boolean;
}

export function hasSavedGame(): boolean {
  return getSavedScore() !== null;
}

export function getSavedScore(): number | null {
  const raw = getString(KEYS.gameCurrent);
  if (!raw) return null;
  const parsed = deserialize(raw);
  return parsed !== null && parsed.status === 'playing' ? parsed.score : null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: createGame(),
  lastEvent: null,
  linesCleared: 0,
  finalResult: null,

  newGame: (options) => {
    const proof = useLeaderboardStore.getState().startRun({
      startedAt: new Date().toISOString(),
      mode: options?.mode ?? 'weekly',
      seed: options?.seed ?? seedFromTime(),
      challengeDate: options?.challengeDate ?? null,
    });
    const game = createGame(proof.seed);
    set({ game, lastEvent: null, linesCleared: 0, finalResult: null });
    setString(KEYS.gameCurrent, serialize(game));
    useAnalyticsStore
      .getState()
      .track('game_start', { mode: options?.mode === 'daily' ? 'daily' : 'weekly' });
  },

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

    if (result.event.gameOver) {
      const final = useScores.getState().submitGame(result.event.score, lines);
      void useLeaderboardStore.getState().finishActiveRun(result.event.score, new Date());
      useStreak.getState().markPlayedToday();
      removeKey(KEYS.gameCurrent);
      set({
        game: result.state,
        lastEvent: result.event,
        linesCleared: 0,
        finalResult: final,
      });
    } else {
      setString(KEYS.gameCurrent, serialize(result.state));
      set({ game: result.state, lastEvent: result.event, linesCleared: lines });
    }

    return result.event;
  },

  reviveGame: () => {
    const { game } = get();
    if (game.status !== 'over' || game.reviveUsed) return;
    const next = revive(game);
    set({ game: next, finalResult: null, lastEvent: null });
    setString(KEYS.gameCurrent, serialize(next));
  },

  loadSaved: () => {
    const raw = getString(KEYS.gameCurrent);
    if (!raw) return false;
    const game = deserialize(raw);
    if (!game || game.status !== 'playing') return false;
    set({ game, lastEvent: null, linesCleared: 0, finalResult: null });
    return true;
  },
}));
