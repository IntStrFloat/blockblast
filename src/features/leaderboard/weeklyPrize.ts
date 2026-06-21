import type { WeeklyLeaderboardSnapshot } from './types';

/**
 * Награды за топ-3 недельного рейтинга (спрашивалось: «легко награждать первые 3 места»).
 * Каждое призовое место даёт бонус-очки в Уровень Игры + эксклюзивную косметику Капи.
 * Факт победы навсегда даёт «чемпионскую рамку» вокруг ника (championRankOf).
 *
 * Косметика взята из непривязанных к уровням предметов каталога (cosmetics.ts),
 * поэтому призы ощущаются эксклюзивными и не пересекаются с обычной прогрессией.
 */
export interface WeeklyPrize {
  rank: number;
  points: number;
  cosmeticId: string;
}

export interface WeeklyPrizeRecord {
  /** Закрытая неделя, за которую начислен приз (weekKey). */
  weekKey: string;
  /** Финальное место игрока на той неделе (1..3). */
  rank: number;
  prize: WeeklyPrize;
  claimed: boolean;
  earnedAt: string;
}

export const WEEKLY_PRIZES: Readonly<Record<number, WeeklyPrize>> = {
  1: { rank: 1, points: 1200, cosmeticId: 'hat-block-crown' },
  2: { rank: 2, points: 700, cosmeticId: 'face-monocle' },
  3: { rank: 3, points: 400, cosmeticId: 'acc-cape' },
};

export function isPrizeRank(rank: number | null | undefined): rank is number {
  return rank != null && rank >= 1 && rank <= 3;
}

export function prizeForRank(rank: number | null | undefined): WeeklyPrize | null {
  if (!isPrizeRank(rank)) return null;
  return WEEKLY_PRIZES[rank] ?? null;
}

/**
 * Подвести итоги прошлой недели в призовую запись — как только неделя сменилась.
 * Чистая функция: возвращает новую запись для добавления либо null. Идемпотентна
 * по weekKey (повторный вызов не создаёт дубликат).
 */
export function settleWeeklyPrize(
  previousSnapshot: WeeklyLeaderboardSnapshot | null,
  currentWeekKey: string,
  existing: readonly WeeklyPrizeRecord[],
  now: Date,
): WeeklyPrizeRecord | null {
  if (!previousSnapshot) return null;
  // Неделя ещё не сменилась — итожить нечего.
  if (previousSnapshot.weekKey === currentWeekKey) return null;
  if (existing.some((record) => record.weekKey === previousSnapshot.weekKey)) return null;

  const rank = previousSnapshot.currentPlayer.rank;
  const prize = prizeForRank(rank);
  if (!prize || rank == null) return null;

  return {
    weekKey: previousSnapshot.weekKey,
    rank,
    prize,
    claimed: false,
    earnedAt: now.toISOString(),
  };
}

/** Первый неполученный приз (для баннера «Забрать награду»). */
export function unclaimedPrize(records: readonly WeeklyPrizeRecord[]): WeeklyPrizeRecord | null {
  return records.find((record) => !record.claimed) ?? null;
}

/**
 * Лучшее (минимальное) место среди записей — драйвер чемпионской рамки вокруг ника.
 * Передавайте уже отфильтрованные записи (например, только claimed).
 */
export function championRankOf(records: readonly WeeklyPrizeRecord[]): number | null {
  let best: number | null = null;
  for (const record of records) {
    if (best === null || record.rank < best) best = record.rank;
  }
  return best;
}
