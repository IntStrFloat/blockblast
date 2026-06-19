import { MASCOT_CONFIG, xpToNext } from './config';
import type { LevelReward, ProgressInfo, Stage } from './types';

/**
 * Возвращает стадию эволюции маскота для заданного уровня.
 * Уровень ниже 1 → стадия 1; уровень выше maxLevel → стадия 4.
 */
export function stageForLevel(level: number): Stage {
  // Clamping: below 1 → stage 1, above maxLevel → stage 4
  if (level < 1) return 1;
  if (level > MASCOT_CONFIG.maxLevel) return 4;

  for (const bound of MASCOT_CONFIG.stageBounds) {
    if (level >= bound.from && level <= bound.to) {
      return bound.stage;
    }
  }

  // Fallback — should never be reached for valid level range
  return 4;
}

/**
 * Вычисляет текущий уровень, стадию и прогресс внутри уровня
 * на основе суммарных накопленных очков прогресса.
 * При достижении maxLevel: xpToNext = 0, xpInLevel = 0 (прогресс-бар заморожен).
 */
export function progressFor(totalXp: number): ProgressInfo {
  const { maxLevel } = MASCOT_CONFIG;
  let level = 1;
  let remaining = Math.max(0, totalXp);

  while (level < maxLevel) {
    const needed = xpToNext(level);
    if (remaining < needed) break;
    remaining -= needed;
    level += 1;
  }

  if (level >= maxLevel) {
    return {
      level: maxLevel,
      stage: stageForLevel(maxLevel),
      xpInLevel: 0,
      xpToNext: 0,
    };
  }

  return {
    level,
    stage: stageForLevel(level),
    xpInLevel: remaining,
    xpToNext: xpToNext(level),
  };
}

/**
 * Возвращает награду за достижение указанного уровня,
 * или null, если уровень не существует в конфиге.
 */
export function rewardForLevel(level: number): LevelReward | null {
  return MASCOT_CONFIG.rewards[level] ?? null;
}
