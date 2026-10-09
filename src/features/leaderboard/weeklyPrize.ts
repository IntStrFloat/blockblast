import type {
  WeeklyClaimReceipt,
  WeeklyServerOutcome,
} from './types';

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
  rewardId: string;
  /** Закрытая неделя, за которую начислен приз (weekKey). */
  weekKey: string;
  /** Финальное место игрока на той неделе (1..3). */
  rank: number;
  prize: WeeklyPrize;
  claimed: boolean;
  earnedAt: string;
  receipt: WeeklyClaimReceipt | null;
  origin: 'server' | 'legacy_local';
  localAppliedAt: string | null;
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

export function weeklyPrizeRecordFromOutcome(
  outcome: WeeklyServerOutcome,
  previous?: WeeklyPrizeRecord,
): WeeklyPrizeRecord | null {
  if (!outcome.reward) return null;
  return {
    rewardId: outcome.reward.rewardId,
    weekKey: outcome.weekKey,
    rank: outcome.rank,
    prize: outcome.reward.prize,
    claimed: outcome.receipt !== null,
    earnedAt: outcome.finalizedAt,
    receipt: outcome.receipt,
    origin: 'server',
    localAppliedAt: previous?.localAppliedAt ?? null,
  };
}

export function normalizeWeeklyPrizeRecord(
  value: Partial<WeeklyPrizeRecord>,
): WeeklyPrizeRecord | null {
  if (
    typeof value.weekKey !== 'string' ||
    typeof value.rank !== 'number' ||
    !value.prize
  ) return null;
  const legacy = typeof value.rewardId !== 'string';
  return {
    rewardId: value.rewardId ?? `legacy:${value.weekKey}:rank-${value.rank}`,
    weekKey: value.weekKey,
    rank: value.rank,
    prize: value.prize,
    claimed: value.claimed === true,
    earnedAt: value.earnedAt ?? new Date(0).toISOString(),
    receipt: value.receipt ?? null,
    origin: value.origin ?? (legacy ? 'legacy_local' : 'server'),
    // Claimed legacy rewards are preserved but never replayed through G03.
    localAppliedAt: value.localAppliedAt ?? (value.claimed ? value.earnedAt ?? new Date(0).toISOString() : null),
  };
}

/** Первый неполученный приз (для баннера «Забрать награду»). */
export function unclaimedPrize(records: readonly WeeklyPrizeRecord[]): WeeklyPrizeRecord | null {
  return records.find((record) => record.origin === 'server' && !record.claimed) ?? null;
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
