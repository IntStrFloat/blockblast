import type { PlacementEvent } from '@/core/engine';

import type { ClearGeometry } from './clearPresentation';
import { GAME_FEEL_MOTION } from './motion';

export interface PlacementParticlePresentation {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  dx: number;
  dy: number;
  rotateDeg: number;
  delayMs: number;
  durationMs: number;
}

export interface PlacementPresentation {
  anchor: { x: number; y: number };
  particles: PlacementParticlePresentation[];
  burstScale: number;
  flashAlpha: number;
  scoreScale: number;
  reducedMotion: boolean;
}

export interface ComboFramePresentation {
  intensity: number;
  lineStrength: number;
  boardClearStrength: number;
  shakeAmplitude: number;
  shakeDurationMs: number;
  scale: number;
  reducedMotion: boolean;
}

type Cell = readonly [number, number];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function feedString(hash: number, value: string) {
  let next = hash >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    next ^= value.charCodeAt(index);
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
}

function presentationSeed(
  event: PlacementEvent,
  geom: ClearGeometry,
  cellColors: readonly string[],
  reducedMotion: boolean,
) {
  let hash = 2166136261;
  const feed = (value: number) => {
    hash ^= value | 0;
    hash = Math.imul(hash, 16777619);
  };

  event.placed.forEach(([row, col]) => {
    feed(row);
    feed(col);
  });
  event.clearedRows.forEach(feed);
  event.clearedCols.forEach(feed);
  event.clearedCells.forEach(([row, col]) => {
    feed(row);
    feed(col);
  });
  event.clearedColors.forEach(feed);
  feed(event.colorId);
  feed(event.score);
  feed(event.scoreDelta);
  feed(event.combo);
  feed(event.boardCleared ? 1 : 0);
  feed(reducedMotion ? 1 : 0);
  feed(geom.boardSize);
  feed(geom.cell);
  feed(geom.gap);
  cellColors.forEach((color) => {
    hash = feedString(hash, color);
  });
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

function centroid(cells: readonly Cell[], geom: ClearGeometry) {
  if (cells.length === 0) {
    return { x: geom.boardSize / 2, y: geom.boardSize / 2 };
  }
  const step = geom.cell + geom.gap;
  const sum = cells.reduce(
    (acc, [row, col]) => ({
      x: acc.x + col * step + geom.cell / 2,
      y: acc.y + row * step + geom.cell / 2,
    }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / cells.length, y: sum.y / cells.length };
}

function colorForIndex(
  cellColors: readonly string[],
  event: PlacementEvent,
  particleIndex: number,
): string {
  if (cellColors.length === 0) return '#FFFFFF';
  const baseIndex = Math.max(0, event.colorId - 1);
  return cellColors[(baseIndex + particleIndex) % cellColors.length] ?? '#FFFFFF';
}

function lineCountFor(event: PlacementEvent) {
  return event.clearedRows.length + event.clearedCols.length;
}

export function scoreScaleFor(score: number): number {
  if (score >= 10000) return GAME_FEEL_MOTION.scoreScaleMax;
  if (score >= 5000) return 1.18;
  if (score >= 1000) return 1.1;
  return 1;
}

export function buildPlacementPresentation(
  event: PlacementEvent,
  geom: ClearGeometry,
  cellColors: readonly string[],
  reducedMotion: boolean,
): PlacementPresentation {
  const anchor = centroid(event.placed as readonly Cell[], geom);
  const random = seededRandom(presentationSeed(event, geom, cellColors, reducedMotion));
  const lineCount = lineCountFor(event);
  const scoreScale = scoreScaleFor(event.score);
  const count = reducedMotion
    ? Math.max(1, Math.min(event.placed.length * 2, GAME_FEEL_MOTION.placementParticleMin))
    : clamp(
        event.placed.length * 2 + Math.min(lineCount, 2) + (event.combo >= 3 ? 1 : 0),
        GAME_FEEL_MOTION.placementParticleMin,
        GAME_FEEL_MOTION.placementParticleMax,
      );

  const particles = Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count + (reducedMotion ? 0 : (random() - 0.5) * 0.42);
    const drift = geom.cell * GAME_FEEL_MOTION.placementParticleDriftCells;
    const travel = reducedMotion
      ? 0
      : geom.cell *
        (0.45 + random() * (GAME_FEEL_MOTION.placementParticleTravelCells - 0.45));
    return {
      id: `placement-${index}`,
      x: anchor.x + Math.cos(angle) * drift * (reducedMotion ? 0.35 : 1),
      y: anchor.y + Math.sin(angle) * drift * (reducedMotion ? 0.35 : 1),
      size: Math.max(2, geom.cell * (0.18 + random() * 0.14)),
      color: colorForIndex(cellColors, event, index),
      dx: reducedMotion ? 0 : Math.cos(angle) * travel,
      dy: reducedMotion ? 0 : Math.sin(angle) * travel,
      rotateDeg: reducedMotion ? 0 : (random() - 0.5) * 40,
      delayMs: Math.round(random() * GAME_FEEL_MOTION.placementParticleDelayMaxMs),
      durationMs: GAME_FEEL_MOTION.placementParticleDurationMs,
    };
  });

  return {
    anchor,
    particles,
    burstScale: reducedMotion
      ? GAME_FEEL_MOTION.reducedPlacementBurstScale
      : clamp(
          1.02 + (scoreScale - 1) * 0.7 + Math.min(lineCount, 3) * 0.02,
          1.02,
          GAME_FEEL_MOTION.placementBurstScaleMax,
        ),
    flashAlpha: reducedMotion
      ? GAME_FEEL_MOTION.reducedPlacementFlashAlpha
      : clamp(0.16 + (scoreScale - 1) * 0.32, 0.16, 0.3),
    scoreScale,
    reducedMotion,
  };
}

export function comboFrameFor(
  event: PlacementEvent,
  reducedMotion: boolean,
): ComboFramePresentation {
  const comboIntensity = clamp((event.combo - 1) / 4, 0, GAME_FEEL_MOTION.comboIntensityMax);
  const lineStrength = clamp(
    lineCountFor(event) / 4,
    0,
    GAME_FEEL_MOTION.comboLineStrengthMax,
  );
  const boardClearStrength = clamp(
    event.boardCleared ? 1 : 0,
    0,
    GAME_FEEL_MOTION.comboBoardClearStrengthMax,
  );
  const shakeBase = clamp(
    comboIntensity * 0.6 + lineStrength * 0.4 + boardClearStrength * 0.3,
    0,
    1,
  );

  return {
    intensity: comboIntensity,
    lineStrength,
    boardClearStrength,
    shakeAmplitude: reducedMotion ? 0 : Math.round(shakeBase * GAME_FEEL_MOTION.comboShakeMax),
    shakeDurationMs: reducedMotion ? 0 : GAME_FEEL_MOTION.comboShakeDurationMs,
    scale: reducedMotion
      ? 1
      : clamp(
          1 + comboIntensity * 0.08 + lineStrength * 0.02 + boardClearStrength * 0.02,
          1,
          GAME_FEEL_MOTION.comboScaleMax,
        ),
    reducedMotion,
  };
}
