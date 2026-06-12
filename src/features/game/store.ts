import { create } from 'zustand';

import {
  createGame,
  deserialize,
  place,
  revive,
  serialize,
} from '@/core/engine';
import type { GameState, PlacementEvent } from '@/core/engine';
import { KEYS, getString, removeKey, setString } from '@/core/storage';
import { useScores } from '@/features/scores';
import type { SubmitResult } from '@/features/scores';
import { useStreak } from '@/features/streak';

interface GameStore {
  game: GameState;
  lastEvent: PlacementEvent | null;
  /** Очищено линий с последней фиксации статистики */
  linesCleared: number;
  /** Итог партии для GameOver-оверлея (null, пока партия идёт) */
  finalResult: SubmitResult | null;
  newGame: () => void;
  placePiece: (trayIndex: number, r: number, c: number) => PlacementEvent | null;
  reviveGame: () => void;
  /** true, если сохранённая партия загружена */
  loadSaved: () => boolean;
}

export function hasSavedGame(): boolean {
  const raw = getString(KEYS.gameCurrent);
  if (!raw) return false;
  const parsed = deserialize(raw);
  return parsed !== null && parsed.status === 'playing';
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: createGame(),
  lastEvent: null,
  linesCleared: 0,
  finalResult: null,

  newGame: () => {
    const game = createGame();
    set({ game, lastEvent: null, linesCleared: 0, finalResult: null });
    setString(KEYS.gameCurrent, serialize(game));
  },

  placePiece: (trayIndex, r, c) => {
    const { game, linesCleared } = get();
    let result: { state: GameState; event: PlacementEvent };
    try {
      result = place(game, trayIndex, r, c);
    } catch {
      return null; // невалидный дроп — UI вернёт фигуру в слот
    }
    const lines =
      linesCleared + result.event.clearedRows.length + result.event.clearedCols.length;

    if (result.event.gameOver) {
      // Фиксация: статистика, стрик, сейв удаляется. Revive после этого
      // продолжает ту же партию; повторный game over зафиксируется как новая попытка.
      const final = useScores.getState().submitGame(result.event.score, lines);
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
