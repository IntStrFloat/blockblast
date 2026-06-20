import { PROGRESSION_CONFIG, type ProgressionConfig } from './config';
import { rewardForLevel } from './rewards';

/**
 * Очки к начислению за game-over: дельта между финальным счётом партии и уже
 * начисленным за текущий эпоч (чтобы ревайв не дублировал очки).
 */
export function awardDelta(alreadyAwarded: number, finalScore: number): number {
  return Math.max(0, Math.floor(finalScore) - Math.max(0, Math.floor(alreadyAwarded)));
}

/** id косметик-наград до указанного уровня включительно — для сверки гардероба на маунте. */
export function cosmeticRewardIdsThroughLevel(
  level: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): string[] {
  const ids: string[] = [];
  for (let L = 1; L <= Math.floor(level); L++) {
    const r = rewardForLevel(L, cfg);
    if (r !== null && r.kind === 'cosmetic') ids.push(r.id);
  }
  return ids;
}
