import type { PlacementEvent } from '@/core/engine';

import {
  buildClearPresentation,
  praiseFontSize,
  shakeForClear,
} from '../animation/clearPresentation';

const CELL_COLORS = ['#ff4d67', '#ffc93c', '#4cc9ff'];
const GEOM = { boardSize: 94, cell: 10, gap: 2 };

function crossEvent(): PlacementEvent {
  const clearedCells = [
    ...Array.from({ length: 8 }, (_, col) => [2, col] as const),
    ...[0, 1, 3, 4, 5, 6, 7].map((row) => [row, 4] as const),
  ];

  return {
    placed: [
      [2, 3],
      [2, 4],
    ],
    colorId: 1,
    clearedRows: [2],
    clearedCols: [4],
    clearedCells,
    clearedColors: clearedCells.map((_, index) => (index % 3) + 1),
    scoreDelta: 240,
    score: 1240,
    combo: 3,
    praise: 'amazing',
    onFire: true,
    boardCleared: false,
    newTray: false,
    gameOver: false,
  };
}

describe('clear presentation geometry', () => {
  it('aligns completed axes to all eight board cells and deduplicates intersections', () => {
    const presentation = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, false);
    const row = presentation.lines.find((line) => line.orientation === 'row');
    const col = presentation.lines.find((line) => line.orientation === 'col');

    expect(row?.segments).toHaveLength(8);
    expect(row?.segments.map(({ x, y }) => [x, y])).toEqual([
      [0, 24],
      [12, 24],
      [24, 24],
      [36, 24],
      [48, 24],
      [60, 24],
      [72, 24],
      [84, 24],
    ]);
    expect(col?.segments).toHaveLength(8);
    expect(col?.segments.map(({ x, y }) => [x, y])).toEqual([
      [48, 0],
      [48, 12],
      [48, 24],
      [48, 36],
      [48, 48],
      [48, 60],
      [48, 72],
      [48, 84],
    ]);
    expect(presentation.intersections).toEqual([
      expect.objectContaining({ row: 2, col: 4, x: 48, y: 24, width: 10, height: 10 }),
    ]);
  });

  it('is deterministic and keeps fragments close to their source cells', () => {
    const first = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, false);
    const second = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, false);

    expect(second).toEqual(first);
    expect(first.fragments).toHaveLength(15 * 4);
    expect(first.fragments.every(({ dx, dy }) => Math.abs(dx) <= 13.5 && Math.abs(dy) <= 13.5)).toBe(
      true,
    );
    expect(first.debris.length).toBeLessThanOrEqual(56);
    expect(first.sparks).toHaveLength(6);
  });

  it('produces a restrained reduced-motion presentation', () => {
    const presentation = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, true);

    expect(presentation.fragments).toHaveLength(15);
    expect(presentation.fragments.every(({ dx, dy, rotateDeg }) => dx === 0 && dy === 0 && rotateDeg === 0)).toBe(
      true,
    );
    expect(presentation.debris.length).toBeLessThanOrEqual(12);
    expect(presentation.debris.every(({ dx, dy }) => dx === 0 && dy === 0)).toBe(true);
    expect(presentation.shake.amplitude).toBe(0);
  });
});

describe('spectacle severity', () => {
  it('scales shake by line count and always disables it for reduced motion', () => {
    expect(shakeForClear(1, false, false)).toEqual(
      expect.objectContaining({ amplitude: 1, scale: 1 }),
    );
    expect(shakeForClear(2, false, false)).toEqual(
      expect.objectContaining({ amplitude: 3, scale: 1 }),
    );
    expect(shakeForClear(3, false, false)).toEqual(
      expect.objectContaining({ amplitude: 4, scale: 1.01 }),
    );
    expect(shakeForClear(4, false, false)).toEqual(
      expect.objectContaining({ amplitude: 5, scale: 1.015 }),
    );
    expect(shakeForClear(1, true, false).amplitude).toBe(5);
    expect(shakeForClear(4, true, true).amplitude).toBe(0);
  });

  it('caps praise typography relative to the board', () => {
    expect(praiseFontSize('good', 320)).toBeLessThan(praiseFontSize('unbelievable', 320));
    expect(praiseFontSize('unbelievable', 320)).toBeLessThanOrEqual(44);
    expect(praiseFontSize('unbelievable', 220)).toBeLessThanOrEqual(36);
  });
});
