import { BOARD_SIZE, type Board, type PraiseTier } from '@/core/engine';

import { centroid, createSeedHasher, seededRandom, type Cell } from './presentationMath';
import { ADVENTURE_SHATTER_MOTION, BURST_MOTION, SPECTACLE_MOTION, clearCellDelay } from './motion';
import {
  buildEffectSequence,
  countEffectSequenceNodes,
  EFFECT_NODE_BUDGET,
  effectSequenceLifetimeMs,
  type ClearAnimationInput,
  type EffectSequence,
} from './effectSequence';

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
 * A luminous particle with physical initial conditions. ClearSparkLayer
 * advances it on the UI thread, rather than replaying a CSS-like keyframe.
 */
export interface ClearSpark {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  velocityX: number;
  velocityY: number;
  gravity: number;
  spinDegPerSecond: number;
  delay: number;
  duration: number;
}

export type ClearStyle = 'dissolve' | 'shatter';

/** A cover for a cell or a fragment; Adventure fragments carry an outward falling arc. */
export interface ClearBurstShard {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  flashColor: string;
  coverColor?: string;
  delay: number;
  duration: number;
  flight?: { dx: number; dy: number; liftY: number; rotationDeg: number };
}

export interface ShakePresentation {
  amplitude: number;
  scale: number;
  durationMs: number;
}

export interface ClearPresentation {
  key: string;
  /** Non-destructive line choreography: lock, charge, impact, wave and afterglow. */
  sequence: EffectSequence;
  /** Крошка-акцент (рендерит ClearDebrisLayer, пул). */
  debris: ClearDebris[];
  /** Светящиеся искры с физикой (рендерит ClearSparkLayer, пул). */
  sparks: ClearSpark[];
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

function eventSeed(event: ClearAnimationInput): number {
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

function colorLookup(event: ClearAnimationInput, cellColors: readonly string[]) {
  const colors = new Map<string, string>();
  event.clearedCells.forEach(([row, col], index) => {
    const colorId = event.clearedColors[index] ?? event.colorId;
    colors.set(cellKey(row, col), cellColors[colorId - 1] ?? '#FFFFFF');
  });
  return (row: number, col: number) => colors.get(cellKey(row, col)) ?? '#FFFFFF';
}

function sampleEffectCells(cells: readonly (readonly [number, number])[], count: number) {
  const stride = cells.length / count;
  return Array.from({ length: count }, (_, index) => cells[Math.floor(index * stride)]!);
}

export function countAnimatedClearNodes(presentation: ClearPresentation) {
  return (
    presentation.shards.length +
    presentation.debris.length +
    presentation.sparks.length +
    countEffectSequenceNodes(presentation.sequence)
  );
}

export function budgetClearPresentations(
  presentations: readonly ClearPresentationInstance[],
  budget = EFFECT_NODE_BUDGET.clearAndPlacement,
): ClearPresentationInstance[] {
  const kept: ClearPresentationInstance[] = [];
  let used = 0;

  for (let index = presentations.length - 1; index >= 0; index -= 1) {
    const entry = presentations[index]!;
    const nodes = countAnimatedClearNodes(entry.presentation);
    // The newest clear is always visible even if a future presentation revision
    // accidentally exceeds the budget on its own; older overlap is what gets shed.
    if (kept.length === 0 || used + nodes <= budget) {
      kept.unshift(entry);
      used += nodes;
    }
    if (kept.length >= MAX_ACTIVE_CLEAR_PRESENTATIONS) break;
  }

  return kept;
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

/** Small chips leave each cleared line; density and travel rise with its clear strength. */
function buildDebris(
  event: ClearAnimationInput,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  reducedMotion: boolean,
  strength: number,
): ClearDebris[] {
  if (reducedMotion || event.clearedCells.length === 0) return [];
  const step = geom.cell + geom.gap;
  const chipCount = Math.min(
    BURST_MOTION.debrisCap,
    Math.max(
      2,
      Math.round((event.clearedCells.length / BURST_MOTION.debrisPerCells) * (1 + strength * 0.4)),
    ),
  );
  const sampledCells = sampleEffectCells(event.clearedCells, chipCount);

  return sampledCells.map(([row, col], index) => {
    const size = Math.max(1, geom.cell * (0.08 + random() * 0.1));
    const angle = (index / chipCount) * Math.PI * 2 + (random() - 0.5) * 0.55;
    const travel = geom.cell * (0.6 + random() * 0.5 + strength * 0.5);
    const outwardX = Math.cos(angle) * travel;
    const driftY = Math.sin(angle) * travel;
    // Крошка вылетает в момент крака своей ячейки — той же волной, что осколки.
    const waveDelay = reducedMotion
      ? 0
      : SPECTACLE_MOTION.debrisStartMs +
        clearCellDelay([row, col], event.placed as readonly Cell[]);
    const delay = waveDelay + Math.round(random() * BURST_MOTION.debrisDelayJitterMs);
    return {
      id: `debris-${index}`,
      x: col * step + geom.cell * (0.18 + random() * 0.64),
      y: row * step + geom.cell * (0.18 + random() * 0.64),
      size,
      color: getColor(row, col),
      dx: outwardX,
      dy: driftY,
      rotateDeg: (random() - 0.5) * 160,
      delay,
      duration: Math.min(420 - delay, 180 + Math.round(random() * 40)),
    };
  });
}

/**
 * Small square glints arc outward from their source. These are data for a
 * small, pooled physics system: velocity/gravity are integrated every frame,
 * so each burst breathes and disperses instead of following a canned tween.
 */
function buildSparks(
  event: ClearAnimationInput,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  reducedMotion: boolean,
  strength: number,
): ClearSpark[] {
  if (reducedMotion || event.clearedCells.length === 0) return [];

  const count = Math.min(
    BURST_MOTION.sparkCap,
    Math.max(
      3,
      Math.round((event.clearedCells.length / BURST_MOTION.sparkPerCells) * (1 + strength * 0.4)),
    ),
  );
  const sampledCells = sampleEffectCells(event.clearedCells, count);
  const step = geom.cell + geom.gap;

  return sampledCells.map(([row, col], index) => {
    const baseColor = getColor(row, col);
    const cellCenterX = col * step + geom.cell / 2;
    const color = index % 4 === 0 ? '#FFF4A8' : lightenColor(baseColor, 0.62);
    const delay = reducedMotion
      ? 0
      : SPECTACLE_MOTION.crushStartMs +
        clearCellDelay([row, col], event.placed as readonly Cell[]) +
        Math.round(random() * BURST_MOTION.sparkDelayJitterMs);

    return {
      id: `spark-${index}`,
      x: cellCenterX + (random() - 0.5) * geom.cell * 0.44,
      y: row * step + geom.cell * (0.28 + random() * 0.44),
      size: Math.max(1, geom.cell * (0.09 + random() * 0.08)),
      color,
      velocityX: (index % 2 === 0 ? -1 : 1) * geom.cell * (1.4 + random() * 2.3 + strength * 1.3),
      velocityY: -geom.cell * (1.8 + random() * 1.8 + strength),
      gravity: geom.cell * (5 + random() * 3),
      spinDegPerSecond: (random() - 0.5) * 260,
      delay,
      duration: reducedMotion
        ? 180
        : Math.min(
            420 - delay,
            BURST_MOTION.sparkDurationMinMs +
              Math.round(random() * BURST_MOTION.sparkDurationJitterMs),
          ),
    };
  });
}

/** Every removed block is covered in frame zero and dissolves locally. */
function buildBurstShards(
  event: ClearAnimationInput,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  reducedMotion: boolean,
): ClearBurstShard[] {
  const step = geom.cell + geom.gap;
  return event.clearedCells.slice(0, BURST_MOTION.shardPoolSize).map(([row, col], index) => {
    const color = getColor(row, col);
    return {
      id: `shard-${index}`,
      x: col * step,
      y: row * step,
      width: geom.cell,
      height: geom.cell,
      color,
      coverColor: color,
      flashColor: reducedMotion ? color : '#FFFFFF',
      delay: reducedMotion
        ? 0
        : SPECTACLE_MOTION.crushStartMs +
          clearCellDelay([row, col], event.placed as readonly Cell[]),
      duration: reducedMotion ? BURST_MOTION.reducedFadeMs : BURST_MOTION.dissolveDurationMs,
    };
  });
}

function buildShatteringShards(
  event: ClearAnimationInput,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  maxShards: number,
): ClearBurstShard[] {
  const cells = event.clearedCells.slice(0, BURST_MOTION.shardPoolSize);
  const counts: number[] = cells.map(() =>
    cells.length <= BURST_MOTION.shardPoolSize / 2 ? 2 : 1,
  );
  let spare = maxShards - counts.reduce((sum, count) => sum + count, 0);
  // Split every block before spending spare fragments on the cells closest to the move.
  const nearest = cells
    .map((cell, index) => ({ index, delay: clearCellDelay(cell, event.placed) }))
    .sort((a, b) => a.delay - b.delay);
  for (const { index } of nearest) {
    const upgrade = counts[index] === 1 ? 1 : 2;
    if (spare < upgrade) break;
    counts[index] += upgrade;
    spare -= upgrade;
  }
  const step = geom.cell + geom.gap;
  return cells.flatMap(([row, col], index) => {
    const count = counts[index];
    const columns = count === 1 ? 1 : 2;
    const rows = count === 4 ? 2 : 1;
    const width = geom.cell / columns;
    const height = geom.cell / rows;
    const color = getColor(row, col);
    return Array.from({ length: count }, (_, part): ClearBurstShard => {
      const partCol = part % columns;
      const partRow = Math.floor(part / columns);
      const direction = columns === 1 ? (random() < 0.5 ? -1 : 1) : partCol === 0 ? -1 : 1;
      return {
        id: `shard-${index}-${part}`,
        x: col * step + partCol * width,
        y: row * step + partRow * height,
        width,
        height,
        color,
        flashColor: lightenColor(color, BURST_MOTION.crackFlashMix),
        delay: SPECTACLE_MOTION.crushStartMs + clearCellDelay([row, col], event.placed),
        duration: ADVENTURE_SHATTER_MOTION.durationMs,
        flight: {
          dx: direction * geom.cell * (0.45 + random() * 0.75),
          dy: geom.cell * (1.6 + random() * 1.2),
          liftY: -geom.cell * (0.2 + random() * 0.4 + (partRow === 0 ? 0.25 : 0)),
          rotationDeg: direction * (45 + random() * 100),
        },
      };
    });
  });
}

export function shakeForClear(
  lineCount: number,
  boardCleared: boolean,
  reducedMotion: boolean,
): ShakePresentation {
  if (reducedMotion || lineCount <= 0) return { amplitude: 0, scale: 1, durationMs: 0 };
  if (boardCleared || lineCount >= 4) {
    return { amplitude: 2, scale: 1, durationMs: 110 };
  }
  if (lineCount === 3) return { amplitude: 1.5, scale: 1, durationMs: 110 };
  if (lineCount === 2) return { amplitude: 1, scale: 1, durationMs: 100 };
  return { amplitude: 0, scale: 1, durationMs: 0 };
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
  event: ClearAnimationInput,
  geom: ClearGeometry,
  cellColors: readonly string[],
  reducedMotion: boolean,
  clearStyle: ClearStyle = 'dissolve',
): ClearPresentation {
  const getColor = colorLookup(event, cellColors);
  const random = seededRandom(eventSeed(event));
  const centroidPoint = centroid(event.clearedCells as readonly Cell[], geom);
  const lineCount = event.clearedRows.length + event.clearedCols.length;
  // Sublinear growth makes early streaks visible and saturates before dense clears get noisy.
  const strength = event.boardCleared
    ? 1
    : Math.pow(
        Math.max(
          Math.min(1, Math.max(0, lineCount - 1) / 3),
          Math.min(1, Math.max(0, event.combo - 1) / 9),
        ),
        0.8,
      );
  const presentationKey = `${event.score}-${event.combo}-${eventSeed(event)}-${reducedMotion ? 1 : 0}-${clearStyle}`;
  const sequence = buildEffectSequence(event, geom, cellColors, reducedMotion);
  const cellCount = Math.min(event.clearedCells.length, BURST_MOTION.shardPoolSize);
  const minimumShards = cellCount <= BURST_MOTION.shardPoolSize / 2 ? cellCount * 2 : cellCount;
  const shatterBudget = Math.max(
    minimumShards,
    Math.min(
      BURST_MOTION.shardPoolSize,
      EFFECT_NODE_BUDGET.clearAndPlacement -
        countEffectSequenceNodes(sequence) -
        BURST_MOTION.secondaryParticleReserve,
    ),
  );
  const shards =
    clearStyle === 'shatter' && !reducedMotion
      ? buildShatteringShards(event, geom, getColor, random, shatterBudget)
      : buildBurstShards(
          event,
          geom,
          getColor,
          reducedMotion,
        );
  // Preserve every removed block first; secondary accents share the remaining budget.
  let availableNodes = Math.max(
    0,
    EFFECT_NODE_BUDGET.clearAndPlacement - shards.length,
  );
  sequence.motes = sequence.motes.slice(0, Math.floor(availableNodes / 3));
  availableNodes -= sequence.motes.length;
  const debris = buildDebris(event, geom, getColor, random, reducedMotion, strength).slice(
    0,
    Math.ceil(availableNodes / 2),
  );
  availableNodes -= debris.length;
  const sparks = buildSparks(event, geom, getColor, random, reducedMotion, strength).slice(
    0,
    availableNodes,
  );

  return {
    key: presentationKey,
    sequence,
    debris,
    sparks,
    shards,
    centroid: centroidPoint,
    shake: shakeForClear(lineCount, event.boardCleared, reducedMotion),
    praiseFontSize: praiseFontSize(event.praise, geom.boardSize),
    reducedMotion,
  };
}

/** A recovery clears occupied cells independently of placements, scoring and combos. */
export function buildRecoveryClearPresentation(
  previousBoard: Board,
  geom: ClearGeometry,
  cellColors: readonly string[],
  reducedMotion: boolean,
): ClearPresentation {
  const clearedCells: [number, number][] = [];
  const clearedColors: number[] = [];
  previousBoard.forEach((color, index) => {
    if (color === 0) return;
    clearedCells.push([Math.floor(index / BOARD_SIZE), index % BOARD_SIZE]);
    clearedColors.push(color);
  });
  return buildClearPresentation({
    clearedCells,
    clearedColors,
    clearedRows: [],
    clearedCols: [],
    placed: [],
    colorId: clearedColors[0] ?? 1,
    score: 0,
    scoreDelta: 0,
    combo: 0,
    praise: 'none',
    boardCleared: true,
  }, geom, cellColors, reducedMotion);
}

export function clearPresentationLifetimeMs(presentation: ClearPresentation | null): number {
  if (!presentation) return 0;

  const latestDebris = presentation.debris.reduce(
    (max, debris) => Math.max(max, debris.delay + debris.duration),
    0,
  );
  const latestShard = presentation.shards.reduce(
    (max, shard) => Math.max(max, shard.delay + shard.duration),
    0,
  );
  const latestSpark = presentation.sparks.reduce(
    (max, spark) => Math.max(max, spark.delay + spark.duration),
    0,
  );

  return (
    Math.max(
      SPECTACLE_MOTION.praiseEndMs,
      latestDebris,
      latestShard,
      latestSpark,
      effectSequenceLifetimeMs(presentation.sequence),
    ) + 80
  );
}
