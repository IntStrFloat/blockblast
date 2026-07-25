import { createAdventureRun, hasAnyMove } from '@/core/engine';

import {
  ADVENTURE_CONFIG,
  absoluteLevelNumber,
  levelFor,
  seasonLength,
  seasonTiles,
} from '../index';

describe('adventure levels', () => {
  it('generates deterministic score and jewel objectives', () => {
    const first = levelFor(1, 0);
    const jewel = levelFor(1, ADVENTURE_CONFIG.jewelStartLevel);

    expect(first.objective).toEqual({ type: 'score', target: ADVENTURE_CONFIG.scoreBaseTarget });
    expect(jewel.objective.type).toBe('jewels');
    expect(jewel.objective.target).toBe(ADVENTURE_CONFIG.jewelBaseTarget);
    expect(levelFor(1, 5).milestone).toBe(true);
    expect(levelFor(1, 5).objective.target).toBeGreaterThan(levelFor(1, 4).objective.target);
  });

  it('places the expected number of jewels on distinct prefill cells', () => {
    for (let levelIndex = 0; levelIndex < seasonLength(1); levelIndex += 1) {
      const spec = levelFor(1, levelIndex);
      if (spec.objective.type !== 'jewels') continue;

      const boardJewels = Math.max(1, Math.floor(spec.objective.target / 2));
      const prefill = spec.prefill ?? [];
      const jewelCells = prefill.filter((cell) => cell.jewel);
      expect(jewelCells.length).toBe(Math.min(boardJewels, prefill.length));

      const unique = new Set(jewelCells.map((cell) => `${cell.row}:${cell.col}`));
      expect(unique.size).toBe(jewelCells.length);
    }
  });

  it('never prefills a complete row or column', () => {
    for (let levelIndex = 0; levelIndex < seasonLength(1); levelIndex += 1) {
      const prefill = levelFor(1, levelIndex).prefill ?? [];
      const rows = new Array(8).fill(0);
      const cols = new Array(8).fill(0);
      for (const cell of prefill) {
        rows[cell.row] += 1;
        cols[cell.col] += 1;
      }
      expect(Math.max(...rows)).toBeLessThan(8);
      expect(Math.max(...cols)).toBeLessThan(8);
    }
  });

  it('starts every level of the season with at least one legal move', () => {
    for (let levelIndex = 0; levelIndex < seasonLength(1); levelIndex += 1) {
      const run = createAdventureRun(levelFor(1, levelIndex));
      expect(hasAnyMove(run.game.board, run.game.tray)).toBe(true);
    }
  });

  it('keeps season mosaic bounded and milestone-marked', () => {
    expect(seasonLength(1)).toBe(ADVENTURE_CONFIG.seasonTileCount);
    expect(seasonTiles(1)).toHaveLength(ADVENTURE_CONFIG.seasonTileCount);
    expect(seasonTiles(1).filter((tile) => tile.milestone).length).toBeGreaterThan(0);
  });

  it('fills the mosaic bottom-up', () => {
    const tiles = seasonTiles(1);
    expect(tiles[0].row).toBe(Math.max(...tiles.map((tile) => tile.row)));
    expect(tiles[tiles.length - 1].row).toBe(0);
  });

  it('numbers levels across seasons without resetting', () => {
    expect(absoluteLevelNumber(1, 0)).toBe(1);
    expect(absoluteLevelNumber(1, 5)).toBe(6);
    expect(absoluteLevelNumber(2, 0)).toBe(seasonLength(1) + 1);
    expect(absoluteLevelNumber(3, 4)).toBe(seasonLength(1) + seasonLength(2) + 5);
  });
});
