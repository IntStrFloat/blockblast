import type { PlacementEvent } from '@/core/engine';

import {
  buildClearPresentation,
  countAnimatedClearNodes,
  clearPresentationLifetimeMs,
  praiseFontSize,
  shakeForClear,
  type ClearBurstShard,
} from '../animation/clearPresentation';
import { BURST_MOTION, SPECTACLE_MOTION } from '../animation/motion';
import { EFFECT_NODE_BUDGET } from '../animation/effectSequence';

const CELL_COLORS = ['#ff4d67', '#ffc93c', '#4cc9ff'];
const GEOM = { boardSize: 94, cell: 10, gap: 2 };
const STEP = GEOM.cell + GEOM.gap;

function rowEvent(): PlacementEvent {
  const clearedCells = Array.from({ length: 8 }, (_, col) => [3, col] as const);

  return {
    placed: [
      [3, 2],
      [3, 3],
      [3, 4],
    ],
    colorId: 2,
    clearedRows: [3],
    clearedCols: [],
    clearedCells,
    clearedColors: clearedCells.map((_, index) => (index % 3) + 1),
    scoreDelta: 120,
    score: 620,
    combo: 2,
    praise: 'great',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
  };
}

function twoRowEvent(): PlacementEvent {
  const clearedCells = [
    ...Array.from({ length: 8 }, (_, col) => [3, col] as const),
    ...Array.from({ length: 8 }, (_, col) => [4, col] as const),
  ];

  return {
    placed: [
      [3, 3],
      [3, 4],
      [4, 3],
      [4, 4],
    ],
    colorId: 2,
    clearedRows: [3, 4],
    clearedCols: [],
    clearedCells,
    clearedColors: clearedCells.map((_, index) => (index % 3) + 1),
    scoreDelta: 240,
    score: 940,
    combo: 2,
    praise: 'great',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
  };
}

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

function boardClearEvent(): PlacementEvent {
  const clearedCells = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => [row, col] as const),
  ).flat();

  return {
    placed: [
      [3, 3],
      [3, 4],
      [4, 3],
      [4, 4],
    ],
    colorId: 3,
    clearedRows: Array.from({ length: 8 }, (_, row) => row),
    clearedCols: Array.from({ length: 8 }, (_, col) => col),
    clearedCells,
    clearedColors: clearedCells.map((_, index) => (index % 3) + 1),
    scoreDelta: 1280,
    score: 5120,
    combo: 5,
    praise: 'unbelievable',
    onFire: true,
    boardCleared: true,
    newTray: false,
    gameOver: false,
  };
}

/** Осколки, стартующие внутри ячейки (row, col). */
function shardsOfCell(shards: readonly ClearBurstShard[], row: number, col: number) {
  const x = col * STEP;
  const y = row * STEP;
  return shards.filter(
    (shard) => shard.x >= x && shard.x < x + GEOM.cell && shard.y >= y && shard.y < y + GEOM.cell,
  );
}

describe('clear presentation basics', () => {
  it('keeps richer clear particles small, bounded to two cells, and short-lived', () => {
    const geom = { boardSize: 360, cell: 43.25, gap: 2 };
    for (const event of [rowEvent(), crossEvent(), boardClearEvent()]) {
      const presentation = buildClearPresentation(event, geom, CELL_COLORS, false);
      for (const particle of presentation.debris) {
        expect(particle.size).toBeLessThanOrEqual(geom.cell * 0.18);
        expect(Math.hypot(particle.dx, particle.dy)).toBeLessThan(geom.cell * 1.8);
        expect(particle.delay + particle.duration).toBeLessThanOrEqual(420);
      }
      for (const spark of presentation.sparks) {
        expect(spark.size).toBeLessThanOrEqual(geom.cell * 0.18);
        for (const fraction of [0.25, 0.5, 0.75, 1]) {
          const seconds = spark.duration * fraction / 1000;
          const dx = spark.velocityX * seconds;
          const dy = spark.velocityY * seconds + 0.5 * spark.gravity * seconds * seconds;
          expect(Math.hypot(dx, dy)).toBeLessThan(geom.cell * 1.8);
        }
        expect(spark.delay + spark.duration).toBeLessThanOrEqual(420);
      }
    }
  });

  it('is deterministic and keeps fragments plus glow particles within budget', () => {
    const first = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, false);
    const second = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, false);

    expect(second).toEqual(first);
    // Local square confetti is deterministic and pooled.
    expect(first.debris).toHaveLength(BURST_MOTION.debrisCap);
    expect(first.debris.every(({ dx, dy }) => Math.hypot(dx, dy) < GEOM.cell * 1.8)).toBe(true);
    expect(first.sparks).toHaveLength(BURST_MOTION.sparkCap);
  });

  it('caps debris chips regardless of clear size', () => {
    expect(buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false).debris).toHaveLength(11);
    expect(buildClearPresentation(boardClearEvent(), GEOM, CELL_COLORS, false).debris.length).toBeLessThanOrEqual(
      BURST_MOTION.debrisCap,
    );
  });

  it('caps luminous sparks regardless of clear size', () => {
    expect(buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false).sparks).toHaveLength(11);
    expect(buildClearPresentation(boardClearEvent(), GEOM, CELL_COLORS, false).sparks.length).toBeLessThanOrEqual(
      BURST_MOTION.sparkCap,
    );
  });

  it('fires debris on the same crack wave as the shards, not on a global timer', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);
    const maxWave = Math.max(...presentation.shards.map((shard) => shard.delay));

    for (const chip of presentation.debris) {
      expect(chip.delay).toBeGreaterThanOrEqual(0);
      expect(chip.delay).toBeLessThanOrEqual(
        maxWave + BURST_MOTION.debrisDelayJitterMs +
        SPECTACLE_MOTION.debrisStartMs - SPECTACLE_MOTION.crushStartMs,
      );
    }
  });

  it('gives a first single-line clear 2.5 times as many chips and sparks, spread across every block', () => {
    const presentation = buildClearPresentation({ ...rowEvent(), combo: 1 }, GEOM, CELL_COLORS, false);
    expect(presentation.debris).toHaveLength(10);
    expect(presentation.sparks).toHaveLength(10);
    for (const col of rowEvent().clearedCells.map(([, col]) => col)) {
      expect(presentation.debris.some((chip) => Math.floor(chip.x / STEP) === col)).toBe(true);
      expect(presentation.sparks.some((spark) => Math.floor(spark.x / STEP) === col)).toBe(true);
    }
    expect(presentation.debris.some((chip) => Math.hypot(chip.dx, chip.dy) > GEOM.cell * 0.8)).toBe(true);
  });

  it('escalates a single-line streak without increasing the pool or covering the board in large particles', () => {
    const presentations = [1, 2, 5, 10, 100].map((combo) =>
      buildClearPresentation({ ...rowEvent(), combo }, GEOM, CELL_COLORS, false),
    );
    expect(presentations.map(({ debris }) => debris.length)).toEqual([10, 11, 12, 14, 14]);
    expect(presentations.map(({ sparks }) => sparks.length)).toEqual([10, 11, 12, 14, 14]);
    for (const presentation of presentations) {
      expect(countAnimatedClearNodes(presentation)).toBeLessThanOrEqual(48);
    }
  });

  it.each(['dissolve', 'shatter'] as const)('keeps %s deterministic within every pool and the global budget at all intensities', (style) => {
    for (const lineCount of [1, 2, 3, 4, 8]) {
      const clearedCells = Array.from({ length: lineCount }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => [row, col] as const),
      ).flat();
      for (const combo of [1, 2, 5, 10, 100]) {
        const event: PlacementEvent = {
          ...rowEvent(),
          clearedRows: Array.from({ length: lineCount }, (_, row) => row),
          clearedCells,
          clearedColors: clearedCells.map(() => 1),
          combo,
          boardCleared: lineCount === 8,
        };
        const presentation = buildClearPresentation(event, GEOM, CELL_COLORS, false, style);
        expect(presentation).toEqual(buildClearPresentation(event, GEOM, CELL_COLORS, false, style));
        expect(presentation.shards.length).toBeLessThanOrEqual(BURST_MOTION.shardPoolSize);
        expect(presentation.debris.length).toBeLessThanOrEqual(BURST_MOTION.debrisCap);
        expect(presentation.sparks.length).toBeLessThanOrEqual(BURST_MOTION.sparkCap);
        expect(presentation.sequence.motes.length).toBeLessThanOrEqual(8);
        expect(countAnimatedClearNodes(presentation)).toBeLessThanOrEqual(EFFECT_NODE_BUDGET.clearAndPlacement);
        expect(countAnimatedClearNodes(presentation) + EFFECT_NODE_BUDGET.comboCelebrationMax +
          EFFECT_NODE_BUDGET.persistentAuraMax).toBeLessThanOrEqual(EFFECT_NODE_BUDGET.total);
        expect(clearPresentationLifetimeMs(presentation)).toBe(800);
      }
    }
  });

  it('produces a restrained reduced-motion presentation', () => {
    const presentation = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, true);

    expect(presentation.debris.length).toBeLessThanOrEqual(BURST_MOTION.debrisCap);
    expect(presentation.debris.every(({ dx, dy }) => dx === 0 && dy === 0)).toBe(true);
    expect(presentation.sparks.every(({ velocityX, velocityY, gravity, spinDegPerSecond }) =>
      velocityX === 0 && velocityY === 0 && gravity === 0 && spinDegPerSecond === 0,
    )).toBe(true);
    expect(presentation.shake.amplitude).toBe(0);
  });

  it('gives sparks physical initial conditions and sends them out with the same clear wave', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);
    const maxShardDelay = Math.max(...presentation.shards.map((shard) => shard.delay));

    expect(presentation.sparks.length).toBeGreaterThan(0);
    for (const spark of presentation.sparks) {
      expect(spark.velocityY).toBeLessThan(0);
      expect(spark.gravity).toBeGreaterThan(0);
      expect(Math.abs(spark.velocityX)).toBeGreaterThan(0);
      expect(spark.delay).toBeLessThanOrEqual(maxShardDelay + BURST_MOTION.sparkDelayJitterMs);
    }
  });
});

describe('cell dissolution', () => {
  it.each([rowEvent(), twoRowEvent(), crossEvent(), boardClearEvent()])(
    'covers every removed cell exactly once before fading in place', (event) => {
      const presentation = buildClearPresentation(event, GEOM, CELL_COLORS, false);
      expect(presentation.shards).toHaveLength(event.clearedCells.length);
      expect(presentation.shards.length).toBeLessThanOrEqual(BURST_MOTION.shardPoolSize);
      for (const [row, col] of event.clearedCells) {
        const pieces = shardsOfCell(presentation.shards, row, col);
        expect(pieces).toHaveLength(1);
        expect(pieces[0]!.width * pieces[0]!.height).toBe(GEOM.cell * GEOM.cell);
        expect(pieces[0]!.coverColor).toBe(pieces[0]!.color);
        expect(pieces[0]!.flashColor).toBe('#FFFFFF');
        expect(pieces[0]!.delay + pieces[0]!.duration).toBeLessThanOrEqual(420);
      }
    },
  );

  it('keeps the farthest clear cells within a short wave from the placement', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);
    const near = shardsOfCell(presentation.shards, 3, 3)[0]!;
    const far = shardsOfCell(presentation.shards, 3, 0)[0]!;
    expect(far.delay).toBeGreaterThan(near.delay);
    expect(far.delay - near.delay).toBe(135);
  });

  it('uses only opacity coverage under reduced motion', () => {
    const presentation = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, true);
    expect(presentation.debris).toEqual([]);
    expect(presentation.sparks).toEqual([]);
    expect(presentation.sequence.motes).toEqual([]);
    for (const shard of presentation.shards) {
      expect(shard.flashColor).toBe(shard.color);
      expect(shard.delay).toBe(0);
      expect(shard.duration).toBeLessThanOrEqual(150);
    }
  });

  it('keeps full-board coverage and secondary effects under the board node cap', () => {
    const presentation = buildClearPresentation(boardClearEvent(), GEOM, CELL_COLORS, false);
    expect(countAnimatedClearNodes(presentation)).toBeLessThanOrEqual(EFFECT_NODE_BUDGET.clearAndPlacement);
  });
});

describe('spectacle severity', () => {
  it('scales shake by line count and always disables it for reduced motion', () => {
    expect(shakeForClear(1, false, false)).toEqual(
      expect.objectContaining({ amplitude: 0, scale: 1 }),
    );
    expect(shakeForClear(2, false, false)).toEqual(
      expect.objectContaining({ amplitude: 1, scale: 1 }),
    );
    expect(shakeForClear(3, false, false)).toEqual(
      expect.objectContaining({ amplitude: 1.5, scale: 1 }),
    );
    expect(shakeForClear(4, false, false)).toEqual(
      expect.objectContaining({ amplitude: 2, scale: 1 }),
    );
    expect(shakeForClear(1, true, false).amplitude).toBe(2);
    expect(shakeForClear(4, true, true).amplitude).toBe(0);
  });

  it('caps praise typography relative to the board', () => {
    expect(praiseFontSize('good', 320)).toBeLessThan(praiseFontSize('unbelievable', 320));
    expect(praiseFontSize('unbelievable', 320)).toBeLessThanOrEqual(44);
    expect(praiseFontSize('unbelievable', 220)).toBeLessThanOrEqual(36);
  });
});
