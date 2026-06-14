export const TRAY_ACTIVATION = {
  top: 0,
  left: 0,
  right: 0,
  bottom: -24,
} as const;

export const TRAY_MOTION = {
  restingScale: 0.65,
  grabScale: 0.92,
  grabDurationMs: 110,
  appearFromScale: 0.9,
  appearDurationMs: 110,
  returnDurationMs: 130,
  returnScaleDurationMs: 100,
} as const;

export const CLEAR_MOTION = {
  staggerMs: 10,
  durationMs: 310,
  popScale: 1.18,
  collapseScale: 0.18,
  flashDurationMs: 260,
} as const;

export const PARTICLE_MOTION = {
  maxParticles: 36,
  maxSources: 12,
  fragmentsPerSource: 3,
  durationMs: 520,
} as const;

export const SPECTACLE_MOTION = {
  placementEndMs: 90,
  lineLockStartMs: 35,
  lineLockEndMs: 165,
  flareStartMs: 90,
  flareEndMs: 205,
  crushStartMs: 145,
  crushEndMs: 335,
  debrisStartMs: 175,
  debrisEndMs: 475,
  praiseStartMs: 255,
  praiseEndMs: 820,
  maxDebris: 56,
  reducedDebris: 12,
  sparkCount: 6,
} as const;

export const GAME_FEEL_MOTION = {
  scoreScaleMax: 1.25,
  placementParticleMin: 6,
  placementParticleMax: 12,
  placementParticleTravelCells: 1.05,
  placementParticleDriftCells: 0.32,
  placementParticleDelayMaxMs: 70,
  placementParticleDurationMs: 420,
  placementBurstScaleMax: 1.16,
  reducedPlacementBurstScale: 1.02,
  reducedPlacementFlashAlpha: 0.16,
  comboIntensityMax: 1,
  comboLineStrengthMax: 1,
  comboBoardClearStrengthMax: 1,
  comboShakeMax: 6,
  comboShakeDurationMs: 165,
  comboScaleMax: 1.12,
  recordConfettiMax: 18,
} as const;

type Cell = readonly [number, number];

export function clearCellDelay(cell: Cell, placed: readonly Cell[]): number {
  const count = Math.max(placed.length, 1);
  const centerRow = placed.reduce((sum, [row]) => sum + row, 0) / count;
  const centerCol = placed.reduce((sum, [, col]) => sum + col, 0) / count;
  return Math.round(
    (Math.abs(cell[0] - centerRow) + Math.abs(cell[1] - centerCol)) * CLEAR_MOTION.staggerMs,
  );
}

export function particleSourceIndexes(
  cellCount: number,
  maxSources = PARTICLE_MOTION.maxSources,
): number[] {
  if (cellCount <= 0 || maxSources <= 0) return [];
  const stride = Math.max(1, Math.ceil(cellCount / maxSources));
  const indexes: number[] = [];
  for (let index = 0; index < cellCount && indexes.length < maxSources; index += stride) {
    indexes.push(index);
  }
  return indexes;
}
