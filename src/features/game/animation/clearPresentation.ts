import type { PlacementEvent, PraiseTier } from '@/core/engine';

import { centroid, createSeedHasher, seededRandom, type Cell } from './presentationMath';
import { BURST_MOTION, burstIntensityFor, SPECTACLE_MOTION, clearCellDelay } from './motion';

export interface ClearGeometry {
  boardSize: number;
  cell: number;
  gap: number;
}

export interface ClearDebris {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  dx: number;
  dy: number;
  rotateDeg: number;
  delay: number;
  duration: number;
}

/**
 * Осколок пула разрушения (ClearBurstLayer): кусок расколотой ячейки.
 * Осколки одной ячейки тайлят её без зазора, поэтому в кадре клира они
 * визуально неотличимы от блока; затем вспышка-крак, подскок с разлётом
 * от центра ячейки и тяжёлое падение за нижний край доски.
 */
export interface ClearBurstShard {
  id: string;
  /** Стартовая поза — кусок ячейки (top-left и размеры в px доски). */
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  /** Цвет вспышки-крака (осветлённый цвет блока); равен color без вспышки. */
  flashColor: string;
  /** Подскок: смещение вверх (отрицательное, px) и дрейф в сторону. */
  jumpY: number;
  driftX: number;
  /** Падение: финальное смещение (px); y + dy > boardSize. */
  dx: number;
  dy: number;
  rotate: number;
  delay: number;
  fallDuration: number;
}

export interface ShakePresentation {
  amplitude: number;
  scale: number;
  durationMs: number;
}

export interface ClearPresentation {
  key: string;
  /** Крошка-акцент (рендерит ClearDebrisLayer, пул). */
  debris: ClearDebris[];
  /** Осколки разрушения (рендерит ClearBurstLayer, пул). */
  shards: ClearBurstShard[];
  centroid: { x: number; y: number };
  shake: ShakePresentation;
  praiseFontSize: number;
  reducedMotion: boolean;
}

export interface ClearPresentationInstance {
  id: string;
  presentation: ClearPresentation;
}

export const MAX_ACTIVE_CLEAR_PRESENTATIONS = 2;

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function eventSeed(event: PlacementEvent): number {
  const hash = createSeedHasher();
  event.clearedRows.forEach((value) => hash.feedNumber(value));
  event.clearedCols.forEach((value) => hash.feedNumber(value));
  event.clearedCells.forEach(([row, col]) => {
    hash.feedNumber(row);
    hash.feedNumber(col);
  });
  event.clearedColors.forEach((color) => hash.feedNumber(color));
  hash.feedNumber(event.score);
  hash.feedNumber(event.scoreDelta);
  hash.feedNumber(event.combo);
  return hash.value();
}

function colorLookup(event: PlacementEvent, cellColors: readonly string[]) {
  const colors = new Map<string, string>();
  event.clearedCells.forEach(([row, col], index) => {
    const colorId = event.clearedColors[index] ?? event.colorId;
    colors.set(cellKey(row, col), cellColors[colorId - 1] ?? '#FFFFFF');
  });
  return (row: number, col: number) => colors.get(cellKey(row, col)) ?? '#FFFFFF';
}

function sampleEffectCells(
  cells: readonly (readonly [number, number])[],
  maxCells: number,
) {
  if (cells.length <= maxCells) return [...cells];
  const stride = cells.length / maxCells;
  return Array.from({ length: maxCells }, (_, index) => cells[Math.floor(index * stride)]!);
}

export function countAnimatedClearNodes(presentation: ClearPresentation) {
  return presentation.shards.length + presentation.debris.length;
}

/** Осветление hex-цвета к белому: вспышка-крак в момент раскола. */
function lightenColor(hex: string, mix: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return '#FFFFFF';
  const value = parseInt(match[1]!, 16);
  const channel = (shift: number) => {
    const base = (value >> shift) & 0xff;
    return Math.round(base + (255 - base) * mix);
  };
  const mixed = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${mixed.toString(16).padStart(6, '0').toUpperCase()}`;
}

/** Крошка-акцент: 1 частица на BURST_MOTION.debrisPerCells ячеек, cap debrisCap. */
function buildDebris(
  event: PlacementEvent,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  reducedMotion: boolean,
): ClearDebris[] {
  if (event.clearedCells.length === 0) return [];
  const step = geom.cell + geom.gap;
  const baseChipCount = Math.min(
    BURST_MOTION.debrisCap,
    Math.max(2, Math.floor(event.clearedCells.length / BURST_MOTION.debrisPerCells)),
  );
  const chipCount = reducedMotion
    ? Math.min(SPECTACLE_MOTION.reducedDebris, baseChipCount)
    : baseChipCount;
  const sampledCells = sampleEffectCells(event.clearedCells, chipCount);

  return sampledCells.map(([row, col], index) => {
    const size = Math.max(2, geom.cell * (0.09 + random() * 0.1));
    const outwardX = (random() - 0.5) * geom.cell * 1.1;
    const impulseY = -geom.cell * (0.12 + random() * 0.12);
    // Крошка вылетает в момент крака своей ячейки — той же волной, что осколки.
    const waveDelay = reducedMotion ? 0 : clearCellDelay([row, col], event.placed as readonly Cell[]);
    return {
      id: `debris-${index}`,
      x: col * step + geom.cell * (0.18 + random() * 0.64),
      y: row * step + geom.cell * (0.18 + random() * 0.64),
      size,
      color: getColor(row, col),
      dx: reducedMotion ? 0 : outwardX,
      dy: reducedMotion ? 0 : geom.boardSize + impulseY + geom.cell * (0.55 + random() * 1.2),
      rotateDeg: reducedMotion ? 0 : (random() - 0.5) * 360,
      delay: waveDelay + Math.round(random() * BURST_MOTION.debrisDelayJitterMs),
      duration: reducedMotion ? 180 : 340 + Math.round(random() * 160),
    };
  });
}

interface ShardRect {
  ox: number;
  oy: number;
  w: number;
  h: number;
}

/** Куски ячейки: 4 квадранта, 2 половины (случайная ось) или целая ячейка. */
function shardRects(count: number, size: number, random: () => number): ShardRect[] {
  const half = size / 2;
  if (count >= 4) {
    return [
      { ox: 0, oy: 0, w: half, h: half },
      { ox: half, oy: 0, w: half, h: half },
      { ox: 0, oy: half, w: half, h: half },
      { ox: half, oy: half, w: half, h: half },
    ];
  }
  if (count === 2) {
    return random() < 0.5
      ? [
          { ox: 0, oy: 0, w: half, h: size },
          { ox: half, oy: 0, w: half, h: size },
        ]
      : [
          { ox: 0, oy: 0, w: size, h: half },
          { ox: 0, oy: half, w: size, h: half },
        ];
  }
  return [{ ox: 0, oy: 0, w: size, h: size }];
}

/**
 * Раскладка бюджета осколков: каждая ячейка получает 4/2/1 кусков, ближние к
 * месту хода (меньшая волновая задержка) колются сильнее. Сумма ≤ budget.
 */
function shardCountPlan(cellDelays: readonly number[], budget: number): number[] {
  const count = cellDelays.length;
  if (count * 4 <= budget) return cellDelays.map(() => 4);

  const order = cellDelays
    .map((delay, index) => ({ delay, index }))
    .sort((a, b) => a.delay - b.delay || a.index - b.index);
  const rank = Array.from({ length: count }, () => 0);
  order.forEach(({ index }, position) => {
    rank[index] = position;
  });

  if (count * 2 <= budget) {
    const upgrades = Math.floor((budget - count * 2) / 2);
    return rank.map((position) => (position < upgrades ? 4 : 2));
  }
  const upgrades = Math.max(0, budget - count);
  return rank.map((position) => (position < upgrades ? 2 : 1));
}

/**
 * Осколки разрушения: ячейка раскалывается на куски, которые тайлят её без
 * зазора (контракт бесшовности — доска пустеет мгновенно, осколки подменяют
 * блок в том же кадре). Физика «тяжёлой гравитации»: волновая задержка от
 * места хода, вспышка-крак, разлёт кусков от центра ячейки и от центроида
 * комбо, кувырок и падение за нижний край; сила масштабируется числом линий.
 */
function buildBurstShards(
  event: PlacementEvent,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  center: { x: number; y: number },
  reducedMotion: boolean,
): ClearBurstShard[] {
  if (event.clearedCells.length === 0) return [];
  const step = geom.cell + geom.gap;
  const budget = BURST_MOTION.shardBudget;
  const cells = sampleEffectCells(event.clearedCells, budget);
  const delays = cells.map((cell) => clearCellDelay(cell, event.placed as readonly Cell[]));
  const counts = reducedMotion ? cells.map(() => 1) : shardCountPlan(delays, budget);
  const lineCount = event.clearedRows.length + event.clearedCols.length;
  const intensity = burstIntensityFor(lineCount, event.boardCleared);

  const shards: ClearBurstShard[] = [];
  cells.forEach(([row, col], cellIndex) => {
    const x = col * step;
    const y = row * step;
    const color = getColor(row, col);
    if (reducedMotion) {
      shards.push({
        id: `shard-${cellIndex}-0`,
        x,
        y,
        width: geom.cell,
        height: geom.cell,
        color,
        flashColor: color,
        jumpY: 0,
        driftX: 0,
        dx: 0,
        dy: 0,
        rotate: 0,
        delay: 0,
        fallDuration: BURST_MOTION.reducedFadeMs,
      });
      return;
    }

    const awaySign = x + geom.cell / 2 >= center.x ? 1 : -1;
    const cellDelay = delays[cellIndex]!;
    const flashColor = lightenColor(color, BURST_MOTION.crackFlashMix);
    shardRects(counts[cellIndex]!, geom.cell, random).forEach((rect, rectIndex) => {
      // Направление разлёта куска от центра расколотой ячейки (-1 | 0 | +1).
      const sepX = rect.w < geom.cell ? Math.sign(rect.ox + rect.w / 2 - geom.cell / 2) : 0;
      const sepY = rect.h < geom.cell ? Math.sign(rect.oy + rect.h / 2 - geom.cell / 2) : 0;
      const separation =
        geom.cell * BURST_MOTION.separationCells * (0.6 + random() * 0.8) * intensity;
      const jump =
        geom.cell * (BURST_MOTION.jumpCells + random() * BURST_MOTION.jumpJitterCells) * intensity;
      const drift =
        awaySign * geom.cell * BURST_MOTION.driftCells * (0.4 + random() * 0.6) * intensity;
      const spin = rect.w < geom.cell || rect.h < geom.cell ? BURST_MOTION.spinBoost : 1;
      shards.push({
        id: `shard-${cellIndex}-${rectIndex}`,
        x: x + rect.ox,
        y: y + rect.oy,
        width: rect.w,
        height: rect.h,
        color,
        flashColor,
        jumpY: -jump + sepY * separation * 0.6,
        driftX: drift + sepX * separation,
        dx:
          drift +
          sepX * separation * 1.6 +
          awaySign * geom.cell * BURST_MOTION.spreadCells * random() * intensity,
        dy: geom.boardSize - (y + rect.oy) + geom.cell * BURST_MOTION.fallOvershootCells,
        rotate:
          (random() < 0.5 ? -1 : 1) *
          (BURST_MOTION.rotateBaseDeg + random() * BURST_MOTION.rotateJitterDeg) *
          intensity *
          spin,
        delay: cellDelay + Math.round(random() * BURST_MOTION.shardDelayJitterMs),
        fallDuration: Math.round(
          BURST_MOTION.fallDurationMinMs + random() * BURST_MOTION.fallDurationJitterMs,
        ),
      });
    });
  });
  return shards;
}

export function shakeForClear(
  lineCount: number,
  boardCleared: boolean,
  reducedMotion: boolean,
): ShakePresentation {
  if (reducedMotion || lineCount <= 0) return { amplitude: 0, scale: 1, durationMs: 0 };
  if (boardCleared || lineCount >= 4) {
    return { amplitude: 5, scale: 1.015, durationMs: 185 };
  }
  if (lineCount === 3) return { amplitude: 4, scale: 1.01, durationMs: 175 };
  if (lineCount === 2) return { amplitude: 3, scale: 1, durationMs: 165 };
  return { amplitude: 1, scale: 1, durationMs: 105 };
}

export function praiseFontSize(tier: PraiseTier, boardSize: number): number {
  if (tier === 'none') return 0;
  const ratios: Record<Exclude<PraiseTier, 'none'>, number> = {
    good: 0.09,
    great: 0.105,
    amazing: 0.12,
    unbelievable: 0.14,
  };
  return Math.round(Math.min(44, Math.max(22, boardSize * ratios[tier])));
}

export function buildClearPresentation(
  event: PlacementEvent,
  geom: ClearGeometry,
  cellColors: readonly string[],
  reducedMotion: boolean,
): ClearPresentation {
  const getColor = colorLookup(event, cellColors);
  const random = seededRandom(eventSeed(event));
  const centroidPoint = centroid(event.clearedCells as readonly Cell[], geom);
  const lineCount = event.clearedRows.length + event.clearedCols.length;
  const presentationKey = `${event.score}-${event.combo}-${eventSeed(event)}-${reducedMotion ? 1 : 0}`;

  return {
    key: presentationKey,
    debris: buildDebris(event, geom, getColor, random, reducedMotion),
    shards: buildBurstShards(event, geom, getColor, random, centroidPoint, reducedMotion),
    centroid: centroidPoint,
    shake: shakeForClear(lineCount, event.boardCleared, reducedMotion),
    praiseFontSize: praiseFontSize(event.praise, geom.boardSize),
    reducedMotion,
  };
}

export function clearPresentationLifetimeMs(presentation: ClearPresentation | null): number {
  if (!presentation) return 0;

  const latestDebris = presentation.debris.reduce(
    (max, debris) => Math.max(max, debris.delay + debris.duration),
    0,
  );
  const latestShard = presentation.shards.reduce(
    (max, shard) => Math.max(max, shard.delay + BURST_MOTION.jumpDurationMs + shard.fallDuration),
    0,
  );

  return Math.max(SPECTACLE_MOTION.praiseEndMs, latestDebris, latestShard) + 80;
}
