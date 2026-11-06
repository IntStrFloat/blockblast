export const TRAY_ACTIVATION = {
  top: 0,
  left: 0,
  right: 0,
  bottom: -24,
} as const;

export const TRAY_MOTION = {
  restingScale: 0.55,
  grabScale: 1,
  grabDurationMs: 80,
  appearFromScale: 0.9,
  appearDurationMs: 150,
  returnDurationMs: 200,
  returnScaleDurationMs: 200,
} as const;

export const CLEAR_MOTION = {
  staggerMs: 45,
  durationMs: 180,
  popScale: 1,
  collapseScale: 0.76,
  flashDurationMs: 90,
} as const;

export const PARTICLE_MOTION = {
  maxParticles: 24,
  maxSources: 8,
  fragmentsPerSource: 3,
  durationMs: 520,
} as const;

export const SPECTACLE_MOTION = {
  placementEndMs: 90,
  lineLockStartMs: 0,
  lineLockEndMs: 60,
  flareStartMs: 20,
  flareEndMs: 85,
  crushStartMs: 20,
  crushEndMs: 210,
  debrisStartMs: 45,
  debrisEndMs: 300,
  praiseStartMs: 210,
  praiseEndMs: 650,
  afterglowEndMs: 720,
  reducedDebris: 12,
  sparkCount: 6,
} as const;

/** Brief cell dissolution with bounded, outward square confetti. */
export const BURST_MOTION = {
  dissolveDurationMs: 160,
  dissolveScale: 0.76,
  reducedFadeMs: 150,
  /** One pre-mounted cover for every board cell. */
  shardPoolSize: 64,
  crackFlashMix: 0.62,
  crackFlashInMs: 30,
  crackFlashOutMs: 70,
  debrisCap: 14,
  debrisPerCells: 0.8,
  debrisDelayJitterMs: 20,
  sparkCap: 14,
  sparkPerCells: 0.8,
  sparkDelayJitterMs: 20,
  sparkDurationMinMs: 190,
  sparkDurationJitterMs: 55,
  /** Keep secondary fragments visible before subdividing Adventure blocks further. */
  secondaryParticleReserve: 20,
  impactShakeDelayMs: 30,
} as const;

/** Adventure blocks split, kick outward and fall before the fragments fade. */
export const ADVENTURE_SHATTER_MOTION = {
  durationMs: 420,
  liftDurationMs: 100,
  fadeDurationMs: 120,
  popScale: 1.08,
  finalScale: 0.65,
} as const;

export const GAME_FEEL_MOTION = {
  scoreScaleMax: 1.25,
  placementParticleMin: 4,
  placementParticleMax: 4,
  placementQueueCap: 2,
  oneLineExternalEffectTargetCap: 48,
  crossMultiLineExternalEffectHardCap: 96,
  placementParticleTravelCells: 0.6,
  placementParticleDriftCells: 0.32,
  placementParticleDelayMaxMs: 70,
  placementParticleDurationMs: 180,
  placementFlashDurationMs: 120,
  placementBurstScaleMax: 1.16,
  reducedPlacementBurstScale: 1.02,
  reducedPlacementFlashAlpha: 0.16,
  comboIntensityMax: 1,
  comboLineStrengthMax: 1,
  comboBoardClearStrengthMax: 1,
  comboFramePulseDurationMs: 220,
  comboFrameReducedDurationMs: 180,
  comboShakeMax: 2,
  comboShakeDurationMs: 145,
  comboScaleMax: 1,
  recordConfettiMax: 14,
} as const;

/** Зазор внутри слота трея, чтобы широкие фигуры не касались соседних. */
export const TRAY_SLOT_INNER_GAP = 10;
/** Shell inset is 8 dp per edge; leave another 2 dp inside its border. */
export const TRAY_SLOT_INNER_GAP_V = 20;

/**
 * Масштаб фигуры в трее в покое. Узкие фигуры держат базовый restingScale,
 * широкие (h4/h5) ужимаются под ширину слота (минус зазор), а высокие (v4/v5) —
 * под высоту слота, чтобы целиком помещаться в свой слот, не налезать на
 * соседнюю фигуру и не вылезать за нижний край трея. slotHeight опционален:
 * без него (Endless — трей заведомо выше фигур) масштаб считается только по
 * ширине, поведение прежнее. floor страхует от вырожденно узкого слота.
 * На захвате фигура подрастает до grabScale.
 */
export function trayRestingScale(
  figureWidth: number,
  figureHeight: number,
  slotWidth: number,
  slotHeight?: number,
  innerGap = TRAY_SLOT_INNER_GAP,
  innerGapV = TRAY_SLOT_INNER_GAP_V,
  baseScale: number = TRAY_MOTION.restingScale,
  floor = 0.2,
): number {
  if (figureWidth <= 0 || !Number.isFinite(slotWidth)) return baseScale;
  let scale = Math.min(baseScale, (slotWidth - innerGap) / figureWidth);
  if (slotHeight != null && Number.isFinite(slotHeight) && figureHeight > 0) {
    scale = Math.min(scale, (slotHeight - innerGapV) / figureHeight);
  }
  return Math.max(floor, scale);
}

/**
 * Пульс размещения ячейки (scale 1.15→1.0) — только на переходе пусто → блок.
 * Маунт уже заполненной ячейки (резюм сохранённой партии) пульсировать не должен.
 */
export function shouldPulseOnFill(prevColorId: number, colorId: number): boolean {
  return prevColorId === 0 && colorId > 0;
}

type Cell = readonly [number, number];

export function clearCellDelay(cell: Cell, placed: readonly Cell[]): number {
  const count = Math.max(placed.length, 1);
  const centerRow = placed.reduce((sum, [row]) => sum + row, 0) / count;
  const centerCol = placed.reduce((sum, [, col]) => sum + col, 0) / count;
  return Math.min(240, Math.round(
    (Math.abs(cell[0] - centerRow) + Math.abs(cell[1] - centerCol)) * CLEAR_MOTION.staggerMs,
  ));
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
