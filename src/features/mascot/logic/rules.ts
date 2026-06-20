import type { HelperId } from './types';
import { MASCOT_CONFIG } from './config';

const { helpers: HELPERS } = MASCOT_CONFIG;

/**
 * Можно ли кормить маскота сегодня.
 * true, если lastFedDay отличается от today (или равен null).
 */
export function canFeed(lastFedDay: string | null, today: string): boolean {
  return lastFedDay !== today;
}

/**
 * Можно ли использовать помощника сегодня.
 * true, если:
 *  - level >= unlockLevel для данного помощника
 *  - usedDay !== today (ещё не использовался сегодня)
 */
export function canUseHelper(
  usedDay: string | undefined,
  today: string,
  level: number,
  helper: HelperId,
): boolean {
  return level >= HELPERS[helper].unlockLevel && usedDay !== today;
}

/** Помощник разблокирован по уровню (без учёта дневного лимита). */
export function isHelperUnlocked(level: number, helper: HelperId): boolean {
  return level >= HELPERS[helper].unlockLevel;
}
