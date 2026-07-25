import { idx, emptyBoard } from '../board';
import { DEFAULT_CONFIG, NOVICE_GAMES, configForExperience } from '../config';
import { createGame } from '../game';
import { trayEnablesClear } from '../game';
import { SHAPES_BY_ID } from '../shapes';
import type { Board, PieceInstance } from '../types';

function pieceOf(id: string, colorId = 1): PieceInstance {
  const shape = SHAPES_BY_ID.get(id);
  if (!shape) throw new Error(`unknown shape ${id}`);
  return { shape, colorId };
}

/** Board with row 0 filled in columns 0..6 — one cell (0,7) short of a line. */
function almostLineBoard(): Board {
  const board = emptyBoard();
  for (let c = 0; c < 7; c += 1) board[idx(0, c)] = 1;
  return board;
}

describe('configForExperience (FTUE spawn assist)', () => {
  it('eases the first games: earlier rescue, shorter dry streak, clear assist on', () => {
    for (const gamesPlayed of [0, 1, NOVICE_GAMES - 1]) {
      const cfg = configForExperience(gamesPlayed);
      expect(cfg.spawn.preferClearAssist).toBe(true);
      expect(cfg.spawn.rescueFullness).toBe(0.6);
      expect(cfg.spawn.rescueDryStreak).toBe(2);
    }
  });

  it('returns the base config unchanged once the player is experienced', () => {
    expect(configForExperience(NOVICE_GAMES)).toBe(DEFAULT_CONFIG);
    expect(configForExperience(50)).toBe(DEFAULT_CONFIG);
    expect(configForExperience(NOVICE_GAMES).spawn.preferClearAssist).toBeUndefined();
  });

  it('does not mutate the base config', () => {
    configForExperience(0);
    expect(DEFAULT_CONFIG.spawn.preferClearAssist).toBeUndefined();
    expect(DEFAULT_CONFIG.spawn.rescueFullness).toBe(0.8);
  });
});

describe('trayEnablesClear', () => {
  it('is true when a tray piece completes a line right now', () => {
    // A single cell drops into (0,7) and clears row 0.
    expect(trayEnablesClear(almostLineBoard(), [pieceOf('dot')])).toBe(true);
  });

  it('is false when no placement of any tray piece completes a line', () => {
    // Empty board: nothing can complete an 8-cell line in one move.
    expect(trayEnablesClear(emptyBoard(), [pieceOf('sq2'), pieceOf('h3')])).toBe(false);
  });
});

describe('createGame with clear assist', () => {
  it('deals a clear-enabling tray on a near-complete line across seeds', () => {
    const assist = configForExperience(0);
    // Deterministic over a spread of seeds: assist should almost always find a
    // clearing tray among its 16 candidates when a line is one cell short.
    const seeds = [1, 7, 42, 1000, 123456];
    const enabling = seeds.filter((seed) => {
      const tray = createGame(seed, assist, almostLineBoard()).tray.filter(
        (p): p is PieceInstance => p !== null,
      );
      return trayEnablesClear(almostLineBoard(), tray);
    });
    expect(enabling.length).toBe(seeds.length);
  });

  it('still deals a fully playable tray', () => {
    const game = createGame(42, configForExperience(0), almostLineBoard());
    expect(game.status).toBe('playing');
    expect(game.tray.filter(Boolean).length).toBe(3);
  });
});
