import type { PlacementEvent } from '@/core/engine';
import { buildClearPresentation, countAnimatedClearNodes } from '../animation/clearPresentation';
import { EFFECT_NODE_BUDGET } from '../animation/effectSequence';
import { BURST_MOTION } from '../animation/motion';

const GEOM = { boardSize: 94, cell: 10, gap: 2 };
const COLORS = ['#44AAFF', '#FFAA22'];

function clearEvent(count = 8): PlacementEvent {
  const cells = Array.from({ length: count }, (_, i) => [Math.floor(i / 8), i % 8] as const);
  return {
    placed: [[0, 3]], colorId: 1,
    clearedCells: cells, clearedRows: [0], clearedCols: [],
    clearedColors: cells.map(() => 1), score: 200, scoreDelta: 80,
    combo: 1, praise: 'good', onFire: false, boardCleared: count === 64,
    newTray: false, gameOver: false,
  };
}

describe('Adventure destruction', () => {
  it('breaks each block into moving pieces while classic keeps its local dissolve', () => {
    const event = clearEvent();
    const classic = buildClearPresentation(event, GEOM, COLORS, false);
    const adventure = buildClearPresentation(event, GEOM, COLORS, false, 'shatter');
    expect(classic.shards).toHaveLength(8);
    expect(classic.shards.every((shard) => !shard.flight)).toBe(true);
    expect(adventure.shards).toHaveLength(32);
    expect(adventure.shards.every((shard) =>
      shard.flight && Math.abs(shard.flight.dx) > 0 && shard.flight.dy > 0 && shard.flight.liftY < 0,
    )).toBe(true);
    expect(adventure).toEqual(buildClearPresentation(event, GEOM, COLORS, false, 'shatter'));
  });

  it.each([8, 15, 16, 28, 32, 40, 64])('covers all %i removed cells without holes or exceeding the pool budget', (count) => {
    const event = clearEvent(count);
    const presentation = buildClearPresentation(event, GEOM, COLORS, false, 'shatter');
    expect(presentation.shards.length).toBeLessThanOrEqual(BURST_MOTION.shardPoolSize);
    expect(countAnimatedClearNodes(presentation)).toBeLessThanOrEqual(EFFECT_NODE_BUDGET.clearAndPlacement);
    for (const [row, col] of event.clearedCells) {
      const x = col * 12;
      const y = row * 12;
      const pieces = presentation.shards.filter(s => s.x >= x && s.x < x + 10 && s.y >= y && s.y < y + 10);
      expect(pieces.reduce((area, s) => area + s.width * s.height, 0)).toBeCloseTo(100);
      if (count <= 32) expect(pieces.length).toBeGreaterThanOrEqual(2);
      expect(pieces.every(s => s.flight)).toBe(true);
    }
  });

  it('keeps reduced motion as an in-place fade with no flying fragments', () => {
    const classic = buildClearPresentation(clearEvent(), GEOM, COLORS, true);
    const adventure = buildClearPresentation(clearEvent(), GEOM, COLORS, true, 'shatter');
    expect(adventure.shards).toEqual(classic.shards);
    expect(adventure.shake.amplitude).toBe(0);
    expect(adventure.shards.every(s => !s.flight)).toBe(true);
  });

  it('reserves chips and sparks before spending the two-line budget on additional subdivisions', () => {
    const event = { ...clearEvent(16), clearedRows: [0, 1] };
    const presentation = buildClearPresentation(event, GEOM, COLORS, false, 'shatter');
    expect(presentation.debris.length).toBeGreaterThanOrEqual(10);
    expect(presentation.sparks.length).toBeGreaterThanOrEqual(10);
    expect(presentation.shards.length).toBeGreaterThanOrEqual(32);
    expect(countAnimatedClearNodes(presentation)).toBeLessThanOrEqual(EFFECT_NODE_BUDGET.clearAndPlacement);
  });

  it('keeps both chip and spark accents even when every board cell shatters', () => {
    const event = {
      ...clearEvent(64),
      clearedRows: Array.from({ length: 8 }, (_, row) => row),
      clearedCols: Array.from({ length: 8 }, (_, col) => col),
    };
    const presentation = buildClearPresentation(event, GEOM, COLORS, false, 'shatter');
    expect(presentation.shards).toHaveLength(64);
    expect(presentation.debris.length).toBeGreaterThan(0);
    expect(presentation.sparks.length).toBeGreaterThan(0);
    expect(countAnimatedClearNodes(presentation)).toBe(EFFECT_NODE_BUDGET.clearAndPlacement);
  });
});
