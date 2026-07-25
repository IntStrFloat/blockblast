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
  maxParticles: 24,
  maxSources: 8,
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
  praiseStartMs: 210,
  praiseEndMs: 650,
  reducedDebris: 12,
  sparkCount: 6,
} as const;

/**
 * Единая система разрушения «тяжёлая гравитация»
 * (docs/superpowers/specs/2026-07-02-clear-burst-gravity-design.md):
 * осколок-ячейка подскакивает и тяжело падает за нижний край доски.
 */
export const BURST_MOTION = {
  popScale: 1.1,
  popDurationMs: 80,
  jumpDurationMs: 140,
  /** Высота подскока в клетках: base + random * jitter, умножается на intensity. */
  jumpCells: 0.55,
  jumpJitterCells: 0.25,
  /** Горизонтальный дрейф за подскок (в клетках, от центроида). */
  driftCells: 0.4,
  fallDurationMinMs: 300,
  fallDurationJitterMs: 130,
  /** Насколько ниже края доски финиширует осколок (в клетках). */
  fallOvershootCells: 1.5,
  /** Дополнительный горизонтальный снос за падение (в клетках). */
  spreadCells: 0.6,
  rotateBaseDeg: 40,
  rotateJitterDeg: 30,
  /** Масштаб осколка к концу падения («улетает от камеры»). */
  fallScale: 0.9,
  /** Затухание у нижней границы — осколки не ложатся поверх трея. */
  fadeDurationMs: 110,
  /** Время жизни осколка в reduced motion (fade на месте). */
  reducedFadeMs: 240,
  /** Интенсивность по числу линий: 1, 2, 3, 4+. */
  intensityByLines: [1, 1.25, 1.5, 1.8],
  /**
   * Бюджет осколков на одну презентацию клира. Ячейка колется на 4/2/1 кусков
   * (ближе к месту хода — сильнее), суммарно не больше shardBudget; два
   * перекрывающихся клира с крошкой укладываются в потолок 96 узлов (спека 07).
   */
  // Keep the clear within a 48-node budget while reserving room for live sparks.
  shardBudget: 32,
  /** Разброс задержки крака между осколками одной ячейки (мс). */
  shardDelayJitterMs: 26,
  /** Разлёт осколков от центра расколотой ячейки (в клетках). */
  separationCells: 0.16,
  /** Кувырок мелких осколков быстрее целой ячейки. */
  spinBoost: 1.45,
  /** Вспышка-крак в момент раскола: осветление цвета блока и время туда/обратно. */
  crackFlashMix: 0.72,
  crackFlashInMs: 50,
  crackFlashOutMs: 160,
  /** Крошка-акцент: 1 частица на debrisPerCells ячеек, не больше debrisCap. */
  debrisCap: 8,
  debrisPerCells: 2,
  /** Разброс задержки крошки поверх волны раскола (мс). */
  debrisDelayJitterMs: 60,
  /** Bright diamond/dot sparks with per-frame velocity and gravity. */
  sparkCap: 8,
  sparkPerCells: 2,
  sparkDelayJitterMs: 52,
  sparkDurationMinMs: 430,
  sparkDurationJitterMs: 170,
  /** Шейк доски бьёт в момент крака у места хода (чуть после pop-а). */
  impactShakeDelayMs: 60,
} as const;

/** Множитель силы разрушения: растёт с числом линий, фулл-клир — максимум. */
export function burstIntensityFor(lineCount: number, boardCleared: boolean): number {
  const table = BURST_MOTION.intensityByLines;
  if (boardCleared) return table[table.length - 1]!;
  const index = Math.min(Math.max(lineCount, 1), table.length) - 1;
  return table[index]!;
}

export const GAME_FEEL_MOTION = {
  scoreScaleMax: 1.25,
  placementParticleMin: 4,
  placementParticleMax: 8,
  placementQueueCap: 2,
  oneLineExternalEffectTargetCap: 48,
  crossMultiLineExternalEffectHardCap: 96,
  placementParticleTravelCells: 1.05,
  placementParticleDriftCells: 0.32,
  placementParticleDelayMaxMs: 70,
  placementParticleDurationMs: 420,
  placementFlashDurationMs: 220,
  placementBurstScaleMax: 1.16,
  reducedPlacementBurstScale: 1.02,
  reducedPlacementFlashAlpha: 0.16,
  comboIntensityMax: 1,
  comboLineStrengthMax: 1,
  comboBoardClearStrengthMax: 1,
  comboFramePulseDurationMs: 220,
  comboFrameReducedDurationMs: 180,
  comboShakeMax: 6,
  comboShakeDurationMs: 145,
  comboScaleMax: 1.12,
  recordConfettiMax: 14,
} as const;

/** Зазор внутри слота трея, чтобы широкие фигуры не касались соседних. */
export const TRAY_SLOT_INNER_GAP = 10;
/** Вертикальный зазор: высокая фигура не касается верх/низ трея и не вылезает. */
export const TRAY_SLOT_INNER_GAP_V = 12;

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
  baseScale = TRAY_MOTION.restingScale,
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
