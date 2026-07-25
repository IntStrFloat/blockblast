/**
 * Атмосфера партии (спека 04, бриф «эволюция сцены»): счёт двигает сцену через
 * фазы — фон, искры и аура доски разгораются по мере игры. Чистый TS без React.
 * Все числа — здесь, не в компонентах (конвенция «игровые числа в конфигах»).
 */

export const ATMOSPHERE = {
  /** Порог очков для входа в фазы 1..3; фаза 0 — старт партии. */
  phaseThresholds: [500, 1500, 3000],
  /** Сколько эмбиент-искр видно в каждой фазе (индекс = фаза). */
  motesPerPhase: [0, 6, 10, 14],
  /** Полный пул искр — вью монтируются один раз и переиспользуются. */
  motePoolSize: 14,
  moteSizeMin: 3,
  moteSizeMax: 6,
  /** Подъём искры за цикл, px. */
  moteDriftPx: 46,
  moteDurationBaseMs: 3600,
  moteDurationStepMs: 420,
  moteOpacityMax: 0.55,
  /** Яркость дополнительной авроры фона по фазе. */
  auroraOpacityPerPhase: [0, 0.22, 0.38, 0.52],
  auroraFadeMs: 1100,
  /** Яркость ауры-обводки доски по фазе. */
  frameOpacityPerPhase: [0, 0.3, 0.52, 0.74],
  frameFadeMs: 700,
  /** «Дыхание» рамки (фаза ≥ breathFromPhase): scale 1 ↔ breathScaleMax. */
  breathFromPhase: 2,
  breathScaleMax: 1.006,
  breathDurationMs: 1900,
  /** Вспышка-свип рамки на смене фазы. */
  sweepDurationMs: 520,
  toastDurationMs: 1600,
} as const;

/** Фаза атмосферы 0..3 от текущего счёта партии. */
export function atmospherePhaseForScore(score: number): number {
  const thresholds = ATMOSPHERE.phaseThresholds;
  let phase = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (score >= thresholds[i]) phase = i + 1;
  }
  return phase;
}

/** Видимых искр в фазе (кламп в границы конфига). */
export function motesForPhase(phase: number): number {
  const counts = ATMOSPHERE.motesPerPhase;
  const index = Math.max(0, Math.min(counts.length - 1, phase));
  return Math.min(counts[index], ATMOSPHERE.motePoolSize);
}

/**
 * Детерминированная раскладка искры по индексу пула: без Math.random в рендере,
 * золотое сечение даёт равномерный, но «живой» разброс по экрану.
 */
export function moteLayout(
  index: number,
  screenWidth: number,
  screenHeight: number,
): { x: number; y: number; size: number; durationMs: number; delayMs: number } {
  const fract = (value: number) => value - Math.floor(value);
  const x = fract(0.12 + index * 0.618034) * screenWidth;
  // Полоса вокруг доски: верхние ~16%..62% экрана, трей и баннер не засоряем.
  const y = (0.16 + fract(0.31 + index * 0.377) * 0.46) * screenHeight;
  const size =
    ATMOSPHERE.moteSizeMin +
    Math.round(fract(index * 0.729) * (ATMOSPHERE.moteSizeMax - ATMOSPHERE.moteSizeMin));
  const durationMs =
    ATMOSPHERE.moteDurationBaseMs + (index % 5) * ATMOSPHERE.moteDurationStepMs;
  const delayMs = Math.round(fract(index * 0.813) * durationMs);
  return { x, y, size, durationMs, delayMs };
}
