import type { PlacementEvent } from '@/core/engine';
import type { HelperId } from './types';
import { MASCOT_CONFIG } from './config';

const { xp: XP, helpers: HELPERS } = MASCOT_CONFIG;

/**
 * XP, начисляемый маскоту за одно событие размещения фигуры.
 *
 * - lines * perClearedLine
 * - если combo > 1: + combo * comboTierBonus
 * - если boardCleared: + boardClear
 * - если isRecord: + newRecord
 */
export function xpFromEvent(e: PlacementEvent, isRecord: boolean): number {
  const lines = e.clearedRows.length + e.clearedCols.length;
  let total = lines * XP.perClearedLine;
  if (e.combo > 1) total += e.combo * XP.comboTierBonus;
  if (e.boardCleared) total += XP.boardClear;
  if (isRecord) total += XP.newRecord;
  return total;
}

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
