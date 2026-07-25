import type { PlacementEvent } from '@/core/engine';

import {
  buildClearPresentation,
  countAnimatedClearNodes,
  praiseFontSize,
  shakeForClear,
  type ClearBurstShard,
} from '../animation/clearPresentation';
import { BURST_MOTION, GAME_FEEL_MOTION } from '../animation/motion';

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
  it('is deterministic and keeps fragments plus glow particles within budget', () => {
    const first = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, false);
    const second = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, false);

    expect(second).toEqual(first);
    // Крошка — акцент: 1 частица на 2 ячейки (cross = 15 ячеек → 7), падает за доску.
    expect(first.debris).toHaveLength(7);
    expect(first.debris.some(({ dy }) => dy > GEOM.boardSize)).toBe(true);
    expect(first.sparks).toHaveLength(BURST_MOTION.sparkCap);
  });

  it('caps debris chips regardless of clear size', () => {
    expect(buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false).debris).toHaveLength(4);
    expect(buildClearPresentation(boardClearEvent(), GEOM, CELL_COLORS, false).debris).toHaveLength(
      BURST_MOTION.debrisCap,
    );
  });

  it('caps luminous sparks regardless of clear size', () => {
    expect(buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false).sparks).toHaveLength(4);
    expect(buildClearPresentation(boardClearEvent(), GEOM, CELL_COLORS, false).sparks).toHaveLength(
      BURST_MOTION.sparkCap,
    );
  });

  it('fires debris on the same crack wave as the shards, not on a global timer', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);
    const maxWave = Math.max(...presentation.shards.map((shard) => shard.delay));

    for (const chip of presentation.debris) {
      expect(chip.delay).toBeGreaterThanOrEqual(0);
      expect(chip.delay).toBeLessThanOrEqual(maxWave + BURST_MOTION.debrisDelayJitterMs);
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
      expect(['diamond', 'dot']).toContain(spark.shape);
    }
  });
});

describe('burst shards: раскол ячеек', () => {
  it('single line: каждая ячейка колется на четыре куска, тайлящих её без зазора', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);

    expect(presentation.shards).toHaveLength(32);
    for (const [row, col] of rowEvent().clearedCells) {
      const pieces = shardsOfCell(presentation.shards, row, col);
      expect(pieces).toHaveLength(4);
      const area = pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0);
      expect(area).toBeCloseTo(GEOM.cell * GEOM.cell);
    }
  });

  it('two lines: бюджет 40 осколков, ближние к месту хода ячейки колются сильнее', () => {
    const event = twoRowEvent();
    const presentation = buildClearPresentation(event, GEOM, CELL_COLORS, false);

    expect(presentation.shards).toHaveLength(BURST_MOTION.shardBudget);

    let quadCells = 0;
    for (const [row, col] of event.clearedCells) {
      const pieces = shardsOfCell(presentation.shards, row, col);
      // Каждая ячейка накрыта кусками полностью — блок не «мигает» в пустоту.
      const area = pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0);
      expect(area).toBeCloseTo(GEOM.cell * GEOM.cell);
      if (pieces.length === 4) {
        quadCells += 1;
        // 4 куска получают ячейки в эпицентре — прямо под ходом.
        expect(event.placed).toContainEqual([row, col]);
      }
    }
    expect(quadCells).toBe(4);
  });

  it('осколки разлетаются от центра расколотой ячейки', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);
    const pieces = shardsOfCell(presentation.shards, 3, 5);
    const left = pieces.filter((piece) => piece.x % STEP < GEOM.cell / 2);
    const right = pieces.filter((piece) => piece.x % STEP >= GEOM.cell / 2);

    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
    // Правые куски дрейфуют правее левых: трещина расходится в стороны.
    const avg = (items: readonly ClearBurstShard[]) =>
      items.reduce((sum, item) => sum + item.driftX, 0) / items.length;
    expect(avg(right)).toBeGreaterThan(avg(left));
  });

  it('каждый осколок вспыхивает светлым краком, подскакивает и падает за доску', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);

    expect(presentation.shards.length).toBeGreaterThan(0);
    for (const shard of presentation.shards) {
      expect(shard.flashColor).not.toBe(shard.color); // вспышка-крак
      expect(shard.jumpY).toBeLessThan(0); // подскок — вверх
      expect(shard.y + shard.dy).toBeGreaterThan(GEOM.boardSize); // финиш ниже доски
      expect(shard.fallDuration).toBeGreaterThanOrEqual(BURST_MOTION.fallDurationMinMs);
      expect(shard.fallDuration).toBeLessThanOrEqual(
        BURST_MOTION.fallDurationMinMs + BURST_MOTION.fallDurationJitterMs,
      );
    }
  });

  it('board clear: остаётся в общем бюджете узлов эффектов', () => {
    const presentation = buildClearPresentation(boardClearEvent(), GEOM, CELL_COLORS, false);

    expect(presentation.shards).toHaveLength(BURST_MOTION.shardBudget);
    expect(countAnimatedClearNodes(presentation)).toBeLessThanOrEqual(
      GAME_FEEL_MOTION.oneLineExternalEffectTargetCap,
    );
  });

  it('интенсивность растёт с размером комбинации', () => {
    const oneLine = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);
    const boardClear = buildClearPresentation(boardClearEvent(), GEOM, CELL_COLORS, false);

    const maxJump = (shards: readonly { jumpY: number }[]) =>
      Math.max(...shards.map((shard) => Math.abs(shard.jumpY)));
    expect(maxJump(boardClear.shards)).toBeGreaterThan(maxJump(oneLine.shards));
  });

  it('волна: задержка осколка растёт с удалением от места хода', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);
    const near = shardsOfCell(presentation.shards, 3, 3);
    const far = shardsOfCell(presentation.shards, 3, 0);
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);

    const minDelay = (items: readonly ClearBurstShard[]) =>
      Math.min(...items.map((item) => item.delay));
    expect(minDelay(far)).toBeGreaterThan(minDelay(near));
  });

  it('reduced motion: целая ячейка, ни движения, ни вспышки', () => {
    const presentation = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, true);

    expect(presentation.shards).toHaveLength(crossEvent().clearedCells.length);
    for (const shard of presentation.shards) {
      expect(shard.width).toBe(GEOM.cell);
      expect(shard.height).toBe(GEOM.cell);
      expect(shard.flashColor).toBe(shard.color);
      expect(shard.jumpY).toBe(0);
      expect(shard.driftX).toBe(0);
      expect(shard.dx).toBe(0);
      expect(shard.dy).toBe(0);
      expect(shard.rotate).toBe(0);
      expect(shard.delay).toBe(0);
    }
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
