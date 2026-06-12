import type { PraiseTier, ScoringConfig } from './types';

/**
 * Очки за один ход.
 * combo — значение серии ПОСЛЕ этого хода (первая очистка = 1).
 * Множитель применяется к очкам очистки; бонус полной доски — после множителя.
 */
export function scorePlacement(
  placedCells: number,
  clearedCount: number,
  lines: number,
  combo: number,
  boardCleared: boolean,
  cfg: ScoringConfig,
): number {
  let total = placedCells * cfg.perPlacedCell;
  if (lines > 0) {
    const bonus = cfg.lineBonus[Math.min(lines, cfg.lineBonus.length - 1)];
    const base = clearedCount * cfg.perClearedCell + bonus;
    const mult = 1 + cfg.comboStep * Math.max(combo - 1, 0);
    total += Math.floor(base * mult);
  }
  if (boardCleared) total += cfg.boardClearBonus;
  return total;
}

export function praiseFor(lines: number): PraiseTier {
  if (lines >= 4) return 'unbelievable';
  if (lines === 3) return 'amazing';
  if (lines === 2) return 'great';
  if (lines === 1) return 'good';
  return 'none';
}
