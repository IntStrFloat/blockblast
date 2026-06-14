import { BOARD_SIZE, type PlacementEvent, type PraiseTier } from '@/core/engine';

import { centroid, createSeedHasher, seededRandom, type Cell } from './presentationMath';
import { GAME_FEEL_MOTION, SPECTACLE_MOTION, clearCellDelay } from './motion';

export interface ClearGeometry {
  boardSize: number;
  cell: number;
  gap: number;
}

export interface ClearSegment {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface ClearLine {
  id: string;
  orientation: 'row' | 'col';
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
  colors: string[];
  segments: ClearSegment[];
}

export interface ClearIntersection {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  colors: [string, string];
}

export interface CrushFragment {
  kind: 'local';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceX: number;
  sourceY: number;
  sourceSize: number;
  color: string;
  dx: number;
  dy: number;
  rotateDeg: number;
  delay: number;
  reducedMotion: boolean;
}

export interface FallingFragment {
  kind: 'falling';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceX: number;
  sourceY: number;
  sourceSize: number;
  color: string;
  impulseX: number;
  impulseY: number;
  dx: number;
  dy: number;
  rotateDeg: number;
  delay: number;
  duration: number;
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

export interface ClearSpark {
  id: string;
  x: number;
  y: number;
  size: number;
  dx: number;
  dy: number;
  delay: number;
}

/** Частица пула разрушения (ClearBurstLayer): стартует как сама ячейка. */
export interface ClearBurstCell {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  dx: number;
  dy: number;
  rotate: number;
  delay: number;
}

export interface ShakePresentation {
  amplitude: number;
  scale: number;
  durationMs: number;
}

export interface ClearPresentation {
  key: string;
  lines: ClearLine[];
  intersections: ClearIntersection[];
  fragments: CrushFragment[];
  fallingFragments: FallingFragment[];
  debris: ClearDebris[];
  sparks: ClearSpark[];
  /** Частицы пула разрушения (рендерит ClearBurstLayer, без mount в hot-path). */
  cells: ClearBurstCell[];
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
export const CLEAR_PRESENTATION_TOTAL_NODE_CAP = Math.floor(
  GAME_FEEL_MOTION.crossMultiLineExternalEffectHardCap / MAX_ACTIVE_CLEAR_PRESENTATIONS,
);

interface TaggedEffect<T> {
  kind: string;
  value: T;
}

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

function makeSegments(
  orientation: ClearLine['orientation'],
  index: number,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
): ClearSegment[] {
  const step = geom.cell + geom.gap;
  return Array.from({ length: BOARD_SIZE }, (_, offset) => {
    const row = orientation === 'row' ? index : offset;
    const col = orientation === 'col' ? index : offset;
    return {
      id: `${orientation}-${index}-${offset}`,
      row,
      col,
      x: col * step,
      y: row * step,
      width: geom.cell,
      height: geom.cell,
      color: getColor(row, col),
    };
  });
}

function makeLine(
  orientation: ClearLine['orientation'],
  index: number,
  order: number,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
): ClearLine {
  const step = geom.cell + geom.gap;
  const segments = makeSegments(orientation, index, geom, getColor);
  return {
    id: `${orientation}-${index}`,
    orientation,
    index,
    x: orientation === 'row' ? 0 : index * step,
    y: orientation === 'row' ? index * step : 0,
    width: orientation === 'row' ? geom.boardSize : geom.cell,
    height: orientation === 'row' ? geom.cell : geom.boardSize,
    delay: SPECTACLE_MOTION.lineLockStartMs + order * 18,
    colors: segments.map((segment) => segment.color),
    segments,
  };
}

function fragmentTravel(
  rowCleared: boolean,
  colCleared: boolean,
  quadrantX: number,
  quadrantY: number,
  cell: number,
  random: () => number,
) {
  if (rowCleared && colCleared) {
    return {
      dx: (quadrantX === 0 ? -1 : 1) * cell * (0.52 + random() * 0.46),
      dy: (quadrantY === 0 ? -1 : 1) * cell * (0.52 + random() * 0.46),
    };
  }
  if (rowCleared) {
    return {
      dx: (random() - 0.5) * cell * 0.55,
      dy: (quadrantY === 0 ? -1 : 1) * cell * (0.48 + random() * 0.5),
    };
  }
  return {
    dx: (quadrantX === 0 ? -1 : 1) * cell * (0.48 + random() * 0.5),
    dy: (random() - 0.5) * cell * 0.55,
  };
}

function buildFragments(
  event: PlacementEvent,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  reducedMotion: boolean,
): CrushFragment[] {
  const step = geom.cell + geom.gap;
  const clearedRows = new Set(event.clearedRows);
  const clearedCols = new Set(event.clearedCols);

  return event.clearedCells.flatMap<CrushFragment>(([row, col], cellIndex) => {
    const baseX = col * step;
    const baseY = row * step;
    const delay =
      SPECTACLE_MOTION.crushStartMs +
      clearCellDelay([row, col], event.placed as readonly Cell[]);

    if (reducedMotion) {
      return [{
        kind: 'local',
        id: `cell-${cellIndex}`,
        x: baseX,
        y: baseY,
        width: geom.cell,
        height: geom.cell,
        sourceX: 0,
        sourceY: 0,
        sourceSize: geom.cell,
        color: getColor(row, col),
        dx: 0,
        dy: 0,
        rotateDeg: 0,
        delay,
        reducedMotion: true,
      }];
    }

    const leftWidth = Math.ceil(geom.cell / 2);
    const rightWidth = geom.cell - leftWidth;
    const topHeight = Math.ceil(geom.cell / 2);
    const bottomHeight = geom.cell - topHeight;

    return [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ].map(([quadrantX, quadrantY], quadrantIndex) => {
      const offsetX = quadrantX === 0 ? 0 : leftWidth;
      const offsetY = quadrantY === 0 ? 0 : topHeight;
      const travel = fragmentTravel(
        clearedRows.has(row),
        clearedCols.has(col),
        quadrantX,
        quadrantY,
        geom.cell,
        random,
      );
      return {
        kind: 'local',
        id: `cell-${cellIndex}-part-${quadrantIndex}`,
        x: baseX + offsetX,
        y: baseY + offsetY,
        width: quadrantX === 0 ? leftWidth : rightWidth,
        height: quadrantY === 0 ? topHeight : bottomHeight,
        sourceX: -offsetX,
        sourceY: -offsetY,
        sourceSize: geom.cell,
        color: getColor(row, col),
        dx: travel.dx,
        dy: travel.dy,
        rotateDeg: (random() - 0.5) * 28,
        delay,
        reducedMotion: false,
      };
    });
  });
}

function externalEffectCap(event: PlacementEvent) {
  return event.clearedRows.length + event.clearedCols.length <= 1
    ? GAME_FEEL_MOTION.oneLineExternalEffectTargetCap
    : GAME_FEEL_MOTION.crossMultiLineExternalEffectHardCap;
}

function sampleEffectCells(
  cells: readonly (readonly [number, number])[],
  maxCells: number,
) {
  if (cells.length <= maxCells) return [...cells];
  const stride = cells.length / maxCells;
  return Array.from({ length: maxCells }, (_, index) => cells[Math.floor(index * stride)]!);
}

function sampleItems<T>(items: readonly T[], maxItems: number): T[] {
  if (maxItems <= 0 || items.length === 0) return [];
  if (items.length <= maxItems) return [...items];
  const stride = items.length / maxItems;
  return Array.from({ length: maxItems }, (_, index) => items[Math.floor(index * stride)]!);
}

function interleaveItems<T>(first: readonly T[], second: readonly T[]) {
  const interleaved: T[] = [];
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    if (index < first.length) interleaved.push(first[index]!);
    if (index < second.length) interleaved.push(second[index]!);
  }
  return interleaved;
}

function allocateSharedBudget(
  firstLength: number,
  secondLength: number,
  totalBudget: number,
) {
  if (totalBudget <= 0) return { first: 0, second: 0 };

  let first = Math.min(firstLength, Math.ceil(totalBudget / 2));
  let second = Math.min(secondLength, Math.floor(totalBudget / 2));
  let remaining = totalBudget - first - second;

  if (remaining > 0 && first < firstLength) {
    const extra = Math.min(firstLength - first, remaining);
    first += extra;
    remaining -= extra;
  }

  if (remaining > 0 && second < secondLength) {
    second += Math.min(secondLength - second, remaining);
  }

  return { first, second };
}

function countAnimatedLineNodes(lines: readonly ClearLine[]) {
  return lines.reduce((sum, line) => sum + 2 + line.segments.length, 0);
}

export function countAnimatedClearNodes(presentation: ClearPresentation) {
  return (
    presentation.fragments.length +
    presentation.fallingFragments.length +
    presentation.debris.length +
    presentation.sparks.length +
    presentation.intersections.length +
    countAnimatedLineNodes(presentation.lines)
  );
}

function budgetLineDetail(
  lines: readonly ClearLine[],
  intersections: readonly ClearIntersection[],
  lineDetailBudget: number,
) {
  if (lineDetailBudget <= 0) {
    return {
      lines: lines.map((line) => ({ ...line, segments: [] })),
      intersections: [] as ClearIntersection[],
    };
  }

  const lineIndexes = sampleItems(
    Array.from({ length: lines.length }, (_, index) => index),
    Math.min(lineDetailBudget, lines.length),
  );
  const segmentBudgets = Array.from({ length: lines.length }, () => 0);
  lineIndexes.forEach((index) => {
    if (lines[index]!.segments.length > 0) segmentBudgets[index] = 1;
  });

  let remainingBudget = lineDetailBudget - segmentBudgets.reduce((sum, count) => sum + count, 0);
  const intersectionCount = Math.min(intersections.length, remainingBudget);
  remainingBudget -= intersectionCount;

  while (remainingBudget > 0) {
    let allocated = false;
    for (let index = 0; index < lines.length && remainingBudget > 0; index += 1) {
      const line = lines[index]!;
      if (segmentBudgets[index]! >= line.segments.length) continue;
      segmentBudgets[index] += 1;
      remainingBudget -= 1;
      allocated = true;
    }
    if (!allocated) break;
  }

  return {
    lines: lines.map((line, index) => ({
      ...line,
      segments: sampleItems(line.segments, segmentBudgets[index]!),
    })),
    intersections: sampleItems(intersections, intersectionCount),
  };
}

function applyPresentationNodeBudget(presentation: ClearPresentation): ClearPresentation {
  const lineShellNodes = presentation.lines.length * 2;
  const mandatoryNodes = lineShellNodes;
  if (mandatoryNodes >= CLEAR_PRESENTATION_TOTAL_NODE_CAP) {
    const lineBudget = budgetLineDetail(presentation.lines, presentation.intersections, 0);
    return {
      ...presentation,
      lines: lineBudget.lines,
      intersections: lineBudget.intersections,
      fragments: [],
      fallingFragments: [],
      debris: [],
      sparks: [],
    };
  }

  let remainingBudget = CLEAR_PRESENTATION_TOTAL_NODE_CAP - mandatoryNodes;
  const totalLineDetailNodes =
    presentation.lines.reduce((sum, line) => sum + line.segments.length, 0) +
    presentation.intersections.length;
  const targetLineDetailBudget = Math.min(
    totalLineDetailNodes,
    totalLineDetailNodes <= 24
      ? totalLineDetailNodes
      : Math.max(
          presentation.lines.length + 4,
          Math.floor(CLEAR_PRESENTATION_TOTAL_NODE_CAP / 3),
        ),
  );
  const lineDetailBudget = Math.min(remainingBudget, targetLineDetailBudget);
  remainingBudget -= lineDetailBudget;

  const sparkBudget = Math.min(remainingBudget, presentation.sparks.length);
  remainingBudget -= sparkBudget;

  const { first: localBudget, second: externalBudget } = allocateSharedBudget(
    presentation.fragments.length,
    presentation.fallingFragments.length + presentation.debris.length,
    remainingBudget,
  );

  const lineBudget = budgetLineDetail(
    presentation.lines,
    presentation.intersections,
    lineDetailBudget,
  );
  const externalEffects = interleaveItems<TaggedEffect<FallingFragment | ClearDebris>>(
    presentation.fallingFragments.map((value) => ({ kind: 'falling', value })),
    presentation.debris.map((value) => ({ kind: 'debris', value })),
  );
  const sampledExternalEffects = sampleItems(externalEffects, externalBudget);

  return {
    ...presentation,
    lines: lineBudget.lines,
    intersections: lineBudget.intersections,
    fragments: sampleItems(presentation.fragments, localBudget),
    fallingFragments: sampledExternalEffects
      .filter((entry): entry is TaggedEffect<FallingFragment> => entry.kind === 'falling')
      .map((entry) => entry.value),
    debris: sampledExternalEffects
      .filter((entry): entry is TaggedEffect<ClearDebris> => entry.kind === 'debris')
      .map((entry) => entry.value),
    sparks: sampleItems(presentation.sparks, sparkBudget),
  };
}

function fallingTravel(
  rowCleared: boolean,
  colCleared: boolean,
  cell: number,
  boardSize: number,
  random: () => number,
) {
  const horizontalBias = rowCleared && !colCleared ? 1.15 : colCleared && !rowCleared ? 0.55 : 0.9;
  const sign = random() < 0.5 ? -1 : 1;
  return {
    impulseX: sign * cell * (0.16 + random() * 0.24) * horizontalBias,
    impulseY: -cell * (0.16 + random() * 0.2),
    dx: sign * cell * (0.65 + random() * 1.8) * horizontalBias,
    dy: boardSize + cell * (0.9 + random() * 1.8),
  };
}

function buildFallingFragments(
  event: PlacementEvent,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  reducedMotion: boolean,
): FallingFragment[] {
  if (reducedMotion || event.clearedCells.length === 0) return [];

  const cap = externalEffectCap(event);
  const fragmentsPerCell = 2;
  const maxCells = Math.max(1, Math.floor(cap / (fragmentsPerCell + 2)));
  const sampledCells = sampleEffectCells(event.clearedCells, maxCells);
  const step = geom.cell + geom.gap;
  const clearedRows = new Set(event.clearedRows);
  const clearedCols = new Set(event.clearedCols);
  const leftWidth = Math.ceil(geom.cell / 2);
  const rightWidth = geom.cell - leftWidth;
  const topHeight = Math.ceil(geom.cell / 2);
  const bottomHeight = geom.cell - topHeight;

  return sampledCells.flatMap<FallingFragment>(([row, col], cellIndex) => {
    const baseX = col * step;
    const baseY = row * step;
    const delay =
      SPECTACLE_MOTION.debrisStartMs - 16 + clearCellDelay([row, col], event.placed as readonly Cell[]);

    return [0, 1].map((fragmentIndex) => {
      const travel = fallingTravel(
        clearedRows.has(row),
        clearedCols.has(col),
        geom.cell,
        geom.boardSize,
        random,
      );
      const rightHalf = fragmentIndex === 1;
      const bottomHalf = random() < 0.5;
      const offsetX = rightHalf ? leftWidth : 0;
      const offsetY = bottomHalf ? topHeight : 0;

      return {
        kind: 'falling',
        id: `falling-${cellIndex}-${fragmentIndex}`,
        x: baseX + offsetX,
        y: baseY + offsetY,
        width: rightHalf ? rightWidth : leftWidth,
        height: bottomHalf ? bottomHeight : topHeight,
        sourceX: -offsetX,
        sourceY: -offsetY,
        sourceSize: geom.cell,
        color: getColor(row, col),
        impulseX: travel.impulseX,
        impulseY: travel.impulseY,
        dx: travel.dx,
        dy: travel.dy,
        rotateDeg: (random() - 0.5) * 90,
        delay,
        duration: 520 + Math.round(random() * 120),
      };
    });
  });
}

function buildDebris(
  event: PlacementEvent,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  reducedMotion: boolean,
): ClearDebris[] {
  if (event.clearedCells.length === 0) return [];
  const cap = externalEffectCap(event);
  const debrisPerCell = 2;
  const maxCells = Math.max(1, Math.floor(cap / (debrisPerCell + 2)));
  const step = geom.cell + geom.gap;
  const sampledCells = sampleEffectCells(event.clearedCells, maxCells);
  const limit = reducedMotion
    ? Math.min(SPECTACLE_MOTION.reducedDebris, sampledCells.length)
    : sampledCells.length * debrisPerCell;

  return Array.from({ length: limit }, (_, index) => {
    const [row, col] = sampledCells[index % sampledCells.length]!;
    const size = Math.max(2, geom.cell * (0.09 + random() * 0.1));
    const outwardX = (random() - 0.5) * geom.cell * 1.1;
    const impulseY = -geom.cell * (0.12 + random() * 0.12);
    return {
      id: `debris-${index}`,
      x: col * step + geom.cell * (0.18 + random() * 0.64),
      y: row * step + geom.cell * (0.18 + random() * 0.64),
      size,
      color: getColor(row, col),
      dx: reducedMotion ? 0 : outwardX,
      dy: reducedMotion ? 0 : geom.boardSize + impulseY + geom.cell * (0.55 + random() * 1.2),
      rotateDeg: reducedMotion ? 0 : (random() - 0.5) * 360,
      delay: SPECTACLE_MOTION.debrisStartMs + Math.round(random() * 60),
      duration: reducedMotion ? 180 : 340 + Math.round(random() * 160),
    };
  });
}

function buildSparks(
  centroid: { x: number; y: number },
  geom: ClearGeometry,
  random: () => number,
  reducedMotion: boolean,
): ClearSpark[] {
  if (reducedMotion) return [];
  return Array.from({ length: SPECTACLE_MOTION.sparkCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / SPECTACLE_MOTION.sparkCount + random() * 0.2;
    const distance = geom.cell * (0.75 + random() * 0.75);
    return {
      id: `spark-${index}`,
      x: centroid.x,
      y: centroid.y,
      size: Math.max(2, geom.cell * 0.08),
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      delay: SPECTACLE_MOTION.flareStartMs + index * 9,
    };
  });
}

/**
 * Частицы пула разрушения: одна на очищенную ячейку (сэмпл до 12 — два
 * перекрывающихся клира укладываются в пул из 24). Стартуют как сама ячейка и
 * разлетаются от центроида с «гравитацией» вниз.
 */
function buildBurstCells(
  event: PlacementEvent,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  center: { x: number; y: number },
  reducedMotion: boolean,
): ClearBurstCell[] {
  if (event.clearedCells.length === 0) return [];
  const step = geom.cell + geom.gap;
  const maxCells = Math.min(event.clearedCells.length, 12);
  const sampled = sampleEffectCells(event.clearedCells, maxCells);

  return sampled.map(([row, col], index) => {
    const x = col * step;
    const y = row * step;
    const base = {
      id: `burst-${index}`,
      x,
      y,
      size: geom.cell,
      color: getColor(row, col),
    };
    if (reducedMotion) {
      return { ...base, dx: 0, dy: 0, rotate: 0, delay: 0 };
    }
    const awayX = x + geom.cell / 2 - center.x;
    const awayY = y + geom.cell / 2 - center.y;
    return {
      ...base,
      dx: awayX * 0.6 + (random() - 0.5) * geom.cell * 0.9,
      dy: awayY * 0.35 + geom.cell * (0.7 + random() * 1.1),
      rotate: (random() - 0.5) * 60,
      delay: Math.round(random() * 45),
    };
  });
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
  const rowLines = event.clearedRows.map((row, order) =>
    makeLine('row', row, order, geom, getColor),
  );
  const colLines = event.clearedCols.map((col, order) =>
    makeLine('col', col, rowLines.length + order, geom, getColor),
  );
  const step = geom.cell + geom.gap;
  const intersections = event.clearedRows.flatMap((row) =>
    event.clearedCols.map((col) => ({
      id: `intersection-${row}-${col}`,
      row,
      col,
      x: col * step,
      y: row * step,
      width: geom.cell,
      height: geom.cell,
      colors: [getColor(row, col), '#FFFFFF'] as [string, string],
    })),
  );
  const centroidPoint = centroid(event.clearedCells as readonly Cell[], geom);
  const lineCount = event.clearedRows.length + event.clearedCols.length;
  const presentationKey = `${event.score}-${event.combo}-${eventSeed(event)}-${reducedMotion ? 1 : 0}`;

  return applyPresentationNodeBudget({
    key: presentationKey,
    lines: [...rowLines, ...colLines],
    intersections,
    fragments: buildFragments(event, geom, getColor, random, reducedMotion),
    fallingFragments: buildFallingFragments(event, geom, getColor, random, reducedMotion),
    debris: buildDebris(event, geom, getColor, random, reducedMotion),
    sparks: buildSparks(centroidPoint, geom, random, reducedMotion),
    cells: buildBurstCells(event, geom, getColor, random, centroidPoint, reducedMotion),
    centroid: centroidPoint,
    shake: shakeForClear(lineCount, event.boardCleared, reducedMotion),
    praiseFontSize: praiseFontSize(event.praise, geom.boardSize),
    reducedMotion,
  });
}

export function clearPresentationLifetimeMs(presentation: ClearPresentation | null): number {
  if (!presentation) return 0;

  const latestLine = presentation.lines.reduce((max, line) => {
    const segmentEnd = line.delay + line.segments.length * 5 + (presentation.reducedMotion ? 205 : 345);
    const lineEnd = line.delay + (presentation.reducedMotion ? 440 : 460);
    return Math.max(max, segmentEnd, lineEnd);
  }, 0);
  const latestIntersection = presentation.intersections.length === 0
    ? 0
    : 90 + (presentation.reducedMotion ? 190 : 315);
  const latestFragment = presentation.fragments.reduce(
    (max, fragment) =>
      Math.max(max, fragment.delay + (fragment.reducedMotion ? 180 : 210)),
    0,
  );
  const latestFallingFragment = presentation.fallingFragments.reduce(
    (max, fragment) => Math.max(max, fragment.delay + fragment.duration),
    0,
  );
  const latestDebris = presentation.debris.reduce(
    (max, debris) => Math.max(max, debris.delay + debris.duration),
    0,
  );
  const latestSpark = presentation.sparks.reduce(
    (max, spark) => Math.max(max, spark.delay + 260),
    0,
  );
  const latestBurst = presentation.cells.reduce(
    (max, cell) => Math.max(max, cell.delay + (presentation.reducedMotion ? 240 : 360)),
    0,
  );

  return Math.max(
    SPECTACLE_MOTION.praiseEndMs,
    latestLine,
    latestIntersection,
    latestFragment,
    latestFallingFragment,
    latestDebris,
    latestSpark,
    latestBurst,
  ) + 80;
}
