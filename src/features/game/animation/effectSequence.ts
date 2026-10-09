import type { PlacementEvent } from '@/core/engine';

import { SPECTACLE_MOTION } from './motion';
import { createSeedHasher, seededRandom } from './presentationMath';

export type EffectStage =
  | 'lock'
  | 'charge'
  | 'impact'
  | 'wave'
  | 'celebration'
  | 'afterglow';

export type EffectSequenceTier =
  | 'line_1'
  | 'line_2'
  | 'line_3_plus'
  | 'combo_2_4'
  | 'combo_5_9'
  | 'combo_10_plus'
  | 'board_clear';

export interface EffectStageWindow {
  stage: EffectStage;
  startMs: number;
  endMs: number;
}

export interface EffectBeam {
  id: string;
  axis: 'row' | 'col';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface EffectMote {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  delayMs: number;
  durationMs: number;
  color: string;
  rotationDeg: number;
}

export interface EffectSequence {
  tier: EffectSequenceTier;
  stages: readonly EffectStageWindow[];
  beams: EffectBeam[];
  motes: EffectMote[];
  reducedMotion: boolean;
}

export interface EffectGeometry {
  boardSize: number;
  cell: number;
  gap: number;
}

export const EFFECT_SEQUENCE_TIMING = {
  lockStartMs: SPECTACLE_MOTION.lineLockStartMs,
  lockEndMs: SPECTACLE_MOTION.lineLockEndMs,
  chargeStartMs: SPECTACLE_MOTION.lineLockStartMs,
  chargeEndMs: SPECTACLE_MOTION.lineLockEndMs,
  impactStartMs: SPECTACLE_MOTION.flareStartMs,
  impactEndMs: SPECTACLE_MOTION.flareEndMs,
  waveStartMs: SPECTACLE_MOTION.debrisStartMs,
  waveEndMs: SPECTACLE_MOTION.debrisEndMs,
  celebrationStartMs: SPECTACLE_MOTION.praiseStartMs,
  celebrationEndMs: SPECTACLE_MOTION.praiseEndMs,
  afterglowStartMs: SPECTACLE_MOTION.crushEndMs,
  afterglowEndMs: SPECTACLE_MOTION.afterglowEndMs,
  comboAuraFadeMs: 280,
  adventureFlightMs: 520,
  adventureArrivalMs: 430,
  adventureOutcomeReadyMs: 520,
  adventureOutcomeReducedMs: 120,
  adventureResultSettleMs: 120,
  adventureOutcomeFallbackMs: 920,
} as const;

export const EFFECT_NODE_BUDGET = {
  total: 96,
  comboCelebrationMax: 20,
  persistentAuraMax: 4,
  clearAndPlacement: 72,
} as const;

const FULL_STAGES: readonly EffectStageWindow[] = [
  { stage: 'lock', startMs: EFFECT_SEQUENCE_TIMING.lockStartMs, endMs: EFFECT_SEQUENCE_TIMING.lockEndMs },
  { stage: 'charge', startMs: EFFECT_SEQUENCE_TIMING.chargeStartMs, endMs: EFFECT_SEQUENCE_TIMING.chargeEndMs },
  { stage: 'impact', startMs: EFFECT_SEQUENCE_TIMING.impactStartMs, endMs: EFFECT_SEQUENCE_TIMING.impactEndMs },
  { stage: 'wave', startMs: EFFECT_SEQUENCE_TIMING.waveStartMs, endMs: EFFECT_SEQUENCE_TIMING.waveEndMs },
  {
    stage: 'celebration',
    startMs: EFFECT_SEQUENCE_TIMING.celebrationStartMs,
    endMs: EFFECT_SEQUENCE_TIMING.celebrationEndMs,
  },
  {
    stage: 'afterglow',
    startMs: EFFECT_SEQUENCE_TIMING.afterglowStartMs,
    endMs: EFFECT_SEQUENCE_TIMING.afterglowEndMs,
  },
];

const REDUCED_STAGES: readonly EffectStageWindow[] = [
  { stage: 'lock', startMs: 0, endMs: 55 },
  { stage: 'charge', startMs: 25, endMs: 120 },
  { stage: 'impact', startMs: 90, endMs: 170 },
  { stage: 'wave', startMs: 110, endMs: 230 },
  { stage: 'celebration', startMs: 130, endMs: 360 },
  { stage: 'afterglow', startMs: 210, endMs: 430 },
];

function lineCountFor(event: PlacementEvent) {
  return event.clearedRows.length + event.clearedCols.length;
}

export function effectSequenceTierFor(event: PlacementEvent): EffectSequenceTier {
  if (event.boardCleared) return 'board_clear';
  if (event.combo >= 10) return 'combo_10_plus';
  if (event.combo >= 5) return 'combo_5_9';
  if (event.combo >= 2) return 'combo_2_4';
  const lines = lineCountFor(event);
  if (lines >= 3) return 'line_3_plus';
  if (lines === 2) return 'line_2';
  return 'line_1';
}

export function highComboAuraIntensity(combo: number): number {
  if (!Number.isFinite(combo) || combo < 5) return 0;
  if (combo >= 10) return 1;
  return 0.46 + ((Math.floor(combo) - 5) / 4) * 0.28;
}

export function effectStageStartMs(
  sequence: EffectSequence,
  stage: EffectStage,
): number {
  return sequence.stages.find((window) => window.stage === stage)?.startMs ?? 0;
}

function eventSeed(event: PlacementEvent) {
  const hash = createSeedHasher();
  event.clearedRows.forEach((row) => hash.feedNumber(row));
  event.clearedCols.forEach((col) => hash.feedNumber(col));
  event.clearedColors.forEach((color) => hash.feedNumber(color));
  hash.feedNumber(event.combo);
  hash.feedNumber(event.score);
  return hash.value();
}

function dominantColor(event: PlacementEvent, colors: readonly string[]) {
  const counts = new Map<number, number>();
  event.clearedColors.forEach((color) => counts.set(color, (counts.get(color) ?? 0) + 1));
  let colorId = event.colorId;
  let count = -1;
  counts.forEach((nextCount, nextColorId) => {
    if (nextCount > count) {
      count = nextCount;
      colorId = nextColorId;
    }
  });
  return colors[Math.max(0, colorId - 1)] ?? '#55DFFF';
}

function buildBeams(
  event: PlacementEvent,
  geom: EffectGeometry,
  color: string,
): EffectBeam[] {
  const thickness = geom.cell * 0.64;
  const rows = event.clearedRows.slice(0, 4);
  const remaining = Math.max(0, 4 - rows.length);
  const cols = event.clearedCols.slice(0, remaining);
  return [
    ...rows.map((row) => ({
      id: `beam-row-${row}`,
      axis: 'row' as const,
      x: 0,
      y: row * (geom.cell + geom.gap) + (geom.cell - thickness) / 2,
      width: geom.boardSize,
      height: thickness,
      color,
    })),
    ...cols.map((col) => ({
      id: `beam-col-${col}`,
      axis: 'col' as const,
      x: col * (geom.cell + geom.gap) + (geom.cell - thickness) / 2,
      y: 0,
      width: thickness,
      height: geom.boardSize,
      color,
    })),
  ];
}

function buildMotes(
  event: PlacementEvent,
  geom: EffectGeometry,
  beams: readonly EffectBeam[],
  color: string,
  reducedMotion: boolean,
): EffectMote[] {
  if (reducedMotion || beams.length === 0) return [];
  const tier = effectSequenceTierFor(event);
  const count = tier === 'line_1' ? 6 : 8;
  const travelStrength = tier === 'line_1' ? 1 : tier === 'combo_10_plus' || tier === 'board_clear' ? 1.4 : 1.2;
  const random = seededRandom(eventSeed(event));

  return Array.from({ length: count }, (_, index) => {
    const beam = beams[index % beams.length]!;
    const horizontal = beam.axis === 'row';
    const source = (index + 0.5) / count * geom.boardSize;
    return {
      id: `line-mote-${index}`,
      x: horizontal ? source : beam.x + beam.width / 2,
      y: horizontal ? beam.y + beam.height / 2 : source,
      dx: (random() - 0.5) * geom.cell * 1.6 * travelStrength,
      dy: (random() - 0.5) * geom.cell * 1.6 * travelStrength,
      size: Math.max(1, geom.cell * (0.08 + random() * 0.1)),
      delayMs: EFFECT_SEQUENCE_TIMING.waveStartMs + Math.round(random() * 24),
      durationMs: 170 + Math.round(random() * 40),
      color: index % 3 === 0 ? '#FFFFFF' : color,
      rotationDeg: 0,
    };
  });
}

export function buildEffectSequence(
  event: PlacementEvent,
  geom: EffectGeometry,
  colors: readonly string[],
  reducedMotion: boolean,
): EffectSequence {
  const color = dominantColor(event, colors);
  const beams = buildBeams(event, geom, color);
  const tier = effectSequenceTierFor(event);

  return {
    tier,
    stages: reducedMotion ? REDUCED_STAGES : FULL_STAGES,
    beams,
    motes: buildMotes(event, geom, beams, color, reducedMotion),
    reducedMotion,
  };
}

export function countEffectSequenceNodes(sequence: EffectSequence): number {
  return sequence.beams.length + sequence.motes.length;
}

export function effectSequenceLifetimeMs(sequence: EffectSequence): number {
  return sequence.stages.reduce((max, stage) => Math.max(max, stage.endMs), 0);
}
