import { BOARD_SIZE, type PlacementEvent, type PraiseTier } from '@/core/engine';

import { SPECTACLE_MOTION, clearCellDelay } from './motion';

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

export interface ShakePresentation {
  amplitude: number;
  scale: number;
  durationMs: number;
}

export interface ClearPresentation {
  lines: ClearLine[];
  intersections: ClearIntersection[];
  fragments: CrushFragment[];
  debris: ClearDebris[];
  sparks: ClearSpark[];
  centroid: { x: number; y: number };
  shake: ShakePresentation;
  praiseFontSize: number;
  reducedMotion: boolean;
}

type Cell = readonly [number, number];

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function eventSeed(event: PlacementEvent): number {
  let hash = 2166136261;
  const feed = (value: number) => {
    hash ^= value | 0;
    hash = Math.imul(hash, 16777619);
  };

  event.clearedRows.forEach(feed);
  event.clearedCols.forEach(feed);
  event.clearedCells.forEach(([row, col]) => {
    feed(row);
    feed(col);
  });
  event.clearedColors.forEach(feed);
  feed(event.score);
  feed(event.scoreDelta);
  feed(event.combo);
  return hash >>> 0 || 1;
}

function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
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

function cellCentroid(cells: readonly Cell[], geom: ClearGeometry) {
  if (cells.length === 0) {
    return { x: geom.boardSize / 2, y: geom.boardSize / 2 };
  }
  const step = geom.cell + geom.gap;
  const total = cells.reduce(
    (sum, [row, col]) => ({
      x: sum.x + col * step + geom.cell / 2,
      y: sum.y + row * step + geom.cell / 2,
    }),
    { x: 0, y: 0 },
  );
  return { x: total.x / cells.length, y: total.y / cells.length };
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

function debrisTravel(
  rowCleared: boolean,
  colCleared: boolean,
  cell: number,
  random: () => number,
) {
  const sign = random() < 0.5 ? -1 : 1;
  if (rowCleared && !colCleared) {
    return {
      dx: sign * cell * (0.7 + random() * 1.55),
      dy: (random() - 0.5) * cell * 0.7,
    };
  }
  if (colCleared && !rowCleared) {
    return {
      dx: (random() - 0.5) * cell * 0.7,
      dy: sign * cell * (0.7 + random() * 1.55),
    };
  }
  const angle = random() * Math.PI * 2;
  const distance = cell * (0.75 + random() * 1.35);
  return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance };
}

function buildDebris(
  event: PlacementEvent,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  reducedMotion: boolean,
): ClearDebris[] {
  if (event.clearedCells.length === 0) return [];
  const limit = reducedMotion
    ? Math.min(SPECTACLE_MOTION.reducedDebris, event.clearedCells.length)
    : Math.min(SPECTACLE_MOTION.maxDebris, event.clearedCells.length * 3);
  const clearedRows = new Set(event.clearedRows);
  const clearedCols = new Set(event.clearedCols);
  const step = geom.cell + geom.gap;

  return Array.from({ length: limit }, (_, index) => {
    const [row, col] = event.clearedCells[index % event.clearedCells.length];
    const size = Math.max(2, geom.cell * (0.09 + random() * 0.1));
    const travel = reducedMotion
      ? { dx: 0, dy: 0 }
      : debrisTravel(clearedRows.has(row), clearedCols.has(col), geom.cell, random);
    return {
      id: `debris-${index}`,
      x: col * step + geom.cell * (0.18 + random() * 0.64),
      y: row * step + geom.cell * (0.18 + random() * 0.64),
      size,
      color: getColor(row, col),
      dx: travel.dx,
      dy: travel.dy,
      rotateDeg: reducedMotion ? 0 : (random() - 0.5) * 360,
      delay: SPECTACLE_MOTION.debrisStartMs + Math.round(random() * 60),
      duration: reducedMotion ? 180 : 300 + Math.round(random() * 175),
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
  const centroid = cellCentroid(event.clearedCells as readonly Cell[], geom);
  const lineCount = event.clearedRows.length + event.clearedCols.length;

  return {
    lines: [...rowLines, ...colLines],
    intersections,
    fragments: buildFragments(event, geom, getColor, random, reducedMotion),
    debris: buildDebris(event, geom, getColor, random, reducedMotion),
    sparks: buildSparks(centroid, geom, random, reducedMotion),
    centroid,
    shake: shakeForClear(lineCount, event.boardCleared, reducedMotion),
    praiseFontSize: praiseFontSize(event.praise, geom.boardSize),
    reducedMotion,
  };
}
