import {
  WEEKLY_PRIZES,
  championRankOf,
  isPrizeRank,
  prizeForRank,
  settleWeeklyPrize,
  unclaimedPrize,
  type WeeklyPrizeRecord,
} from '../weeklyPrize';
import type { LeaderboardEntry, WeeklyLeaderboardSnapshot } from '../types';

const NOW = new Date('2026-06-22T12:00:00.000Z'); // понедельник недели 2026-06-22

function makeSnapshot(weekKey: string, rank: number | null): WeeklyLeaderboardSnapshot {
  const currentPlayer: LeaderboardEntry = {
    nickname: 'LimeComet',
    tag: '00H',
    rank,
    weeklyBest: 4200,
    runsCount: 3,
    achievedAt: null,
    isCurrentPlayer: true,
  };
  return {
    weekKey,
    weekStartIso: `${weekKey}T00:00:00.000Z`,
    weekEndIso: `${weekKey}T00:00:00.000Z`,
    generatedAt: NOW.toISOString(),
    source: 'remote',
    isCached: false,
    currentPlayer,
    entries: [currentPlayer],
  };
}

describe('prizeForRank / isPrizeRank', () => {
  it('даёт приз только за места 1..3', () => {
    expect(prizeForRank(1)).toEqual(WEEKLY_PRIZES[1]);
    expect(prizeForRank(3)).toEqual(WEEKLY_PRIZES[3]);
    expect(prizeForRank(0)).toBeNull();
    expect(prizeForRank(4)).toBeNull();
    expect(prizeForRank(null)).toBeNull();
    expect(prizeForRank(undefined)).toBeNull();
  });

  it('убывающие очки от 1 к 3 места', () => {
    expect(WEEKLY_PRIZES[1].points).toBeGreaterThan(WEEKLY_PRIZES[2].points);
    expect(WEEKLY_PRIZES[2].points).toBeGreaterThan(WEEKLY_PRIZES[3].points);
  });

  it('isPrizeRank узкий тип', () => {
    expect(isPrizeRank(2)).toBe(true);
    expect(isPrizeRank(5)).toBe(false);
    expect(isPrizeRank(null)).toBe(false);
  });
});

describe('settleWeeklyPrize', () => {
  it('null снапшот → нет приза', () => {
    expect(settleWeeklyPrize(null, '2026-06-22', [], NOW)).toBeNull();
  });

  it('неделя не сменилась → нет приза', () => {
    const snap = makeSnapshot('2026-06-22', 1);
    expect(settleWeeklyPrize(snap, '2026-06-22', [], NOW)).toBeNull();
  });

  it('место вне топ-3 → нет приза', () => {
    const snap = makeSnapshot('2026-06-15', 7);
    expect(settleWeeklyPrize(snap, '2026-06-22', [], NOW)).toBeNull();
  });

  it('топ-3 прошлой недели → призовая запись', () => {
    const snap = makeSnapshot('2026-06-15', 2);
    const record = settleWeeklyPrize(snap, '2026-06-22', [], NOW);
    expect(record).toEqual({
      weekKey: '2026-06-15',
      rank: 2,
      prize: WEEKLY_PRIZES[2],
      claimed: false,
      earnedAt: NOW.toISOString(),
    });
  });

  it('идемпотентно: повторная неделя не дублируется', () => {
    const snap = makeSnapshot('2026-06-15', 1);
    const existing: WeeklyPrizeRecord[] = [
      { weekKey: '2026-06-15', rank: 1, prize: WEEKLY_PRIZES[1], claimed: false, earnedAt: NOW.toISOString() },
    ];
    expect(settleWeeklyPrize(snap, '2026-06-22', existing, NOW)).toBeNull();
  });
});

describe('unclaimedPrize / championRankOf', () => {
  const records: WeeklyPrizeRecord[] = [
    { weekKey: '2026-06-01', rank: 3, prize: WEEKLY_PRIZES[3], claimed: true, earnedAt: NOW.toISOString() },
    { weekKey: '2026-06-08', rank: 1, prize: WEEKLY_PRIZES[1], claimed: false, earnedAt: NOW.toISOString() },
  ];

  it('первый неполученный приз', () => {
    expect(unclaimedPrize(records)?.weekKey).toBe('2026-06-08');
    expect(unclaimedPrize([records[0]])).toBeNull();
  });

  it('чемпионское место = лучшее (минимальное)', () => {
    expect(championRankOf(records)).toBe(1);
    expect(championRankOf([records[0]])).toBe(3);
    expect(championRankOf([])).toBeNull();
  });
});
