import type { PlacementEvent } from '@/core/engine';

import { countAnimatedClearNodes, type ClearGeometry, type ClearPresentationInstance } from './clearPresentation';
import { GAME_FEEL_MOTION } from './motion';
import { clamp, centroid, createSeedHasher, seededRandom, type Cell } from './presentationMath';

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

export interface PlacementEffectInstance {
  id: string;
  placement: PlacementPresentation;
  comboFrame: ComboFramePresentation;
  color: string;
}

function presentationSeed(
  event: PlacementEvent,
  geom: ClearGeometry,
  cellColors: readonly string[],
  reducedMotion: boolean,
) {
  const hash = createSeedHasher();
  event.placed.forEach(([row, col]) => {
    hash.feedNumber(row);
    hash.feedNumber(col);
  });
  event.clearedRows.forEach((value) => hash.feedNumber(value));
  event.clearedCols.forEach((value) => hash.feedNumber(value));
  event.clearedCells.forEach(([row, col]) => {
    hash.feedNumber(row);
    hash.feedNumber(col);
  });
  event.clearedColors.forEach((value) => hash.feedNumber(value));
  hash.feedNumber(event.colorId);
  hash.feedNumber(event.score);
  hash.feedNumber(event.scoreDelta);
  hash.feedNumber(event.combo);
  hash.feedNumber(event.boardCleared ? 1 : 0);
  hash.feedNumber(reducedMotion ? 1 : 0);
  hash.feedNumber(geom.boardSize);
  hash.feedNumber(geom.cell);
  hash.feedNumber(geom.gap);
  cellColors.forEach((color) => {
    hash.feedString(color);
  });
  return hash.value();
}

function basePlacementColor(
  cellColors: readonly string[],
  event: PlacementEvent,
): string {
  if (cellColors.length === 0) return '#FFFFFF';
  const baseIndex = Math.max(0, event.colorId - 1);
  return cellColors[baseIndex] ?? '#FFFFFF';
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
  const color = basePlacementColor(cellColors, event);
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
      color,
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
  const comboShakeProgress = clamp((event.combo - 2) / 3, 0, 1);
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

  return {
    intensity: comboIntensity,
    lineStrength,
    boardClearStrength,
    shakeAmplitude: reducedMotion
      ? 0
      : Math.round(comboShakeProgress * GAME_FEEL_MOTION.comboShakeMax),
    shakeDurationMs: reducedMotion || comboShakeProgress <= 0 ? 0 : GAME_FEEL_MOTION.comboShakeDurationMs,
    scale: reducedMotion
      ? 1
      : clamp(1 + comboShakeProgress * 0.12, 1, GAME_FEEL_MOTION.comboScaleMax),
    reducedMotion,
  };
}

export function placementEffectLifetimeMs(
  placement: PlacementPresentation | null,
  comboFrame: ComboFramePresentation | null,
): number {
  if (!placement && !comboFrame) return 0;

  const latestParticle = placement?.particles.reduce(
    (max, particle) => Math.max(max, particle.delayMs + particle.durationMs),
    0,
  ) ?? 0;
  const flashLifetime = placement ? GAME_FEEL_MOTION.placementFlashDurationMs : 0;
  const comboLifetime = comboFrame
    ? Math.max(
        comboFrame.shakeDurationMs,
        comboFrame.reducedMotion
          ? GAME_FEEL_MOTION.comboFrameReducedDurationMs
          : GAME_FEEL_MOTION.comboFramePulseDurationMs,
      )
    : 0;

  return Math.max(latestParticle, flashLifetime, comboLifetime) + 60;
}

export function countAnimatedPlacementNodes(effect: PlacementEffectInstance): number {
  return 1 + effect.placement.particles.length + (effect.comboFrame.intensity > 0 ? 1 : 0);
}

export function totalActiveClearNodes(
  presentations: readonly ClearPresentationInstance[],
): number {
  return presentations.reduce(
    (sum, { presentation }) => sum + countAnimatedClearNodes(presentation),
    0,
  );
}

export function budgetPlacementEffects(
  activeClearNodes: number,
  placementEffects: readonly PlacementEffectInstance[],
): PlacementEffectInstance[] {
  const remaining = Math.max(
    0,
    GAME_FEEL_MOTION.crossMultiLineExternalEffectHardCap - activeClearNodes,
  );
  if (remaining <= 0 || placementEffects.length === 0) return [];

  const kept: PlacementEffectInstance[] = [];
  let used = 0;

  for (let index = placementEffects.length - 1; index >= 0; index -= 1) {
    const effect = placementEffects[index]!;
    const nodes = countAnimatedPlacementNodes(effect);
    if (nodes > remaining - used) continue;
    kept.unshift(effect);
    used += nodes;
    if (kept.length >= GAME_FEEL_MOTION.placementQueueCap) break;
  }

  return kept;
}
