import {
  WEEKLY_PRIZES,
  championRankOf,
  isPrizeRank,
  normalizeWeeklyPrizeRecord,
  prizeForRank,
  unclaimedPrize,
  weeklyPrizeRecordFromOutcome,
  type WeeklyPrizeRecord,
} from '../weeklyPrize';
import type { WeeklyServerOutcome } from '../types';

const NOW = new Date('2026-06-22T12:00:00.000Z'); // понедельник недели 2026-06-22

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

describe('server weekly outcome conversion', () => {
  it('creates entitlement only from a server-confirmed rewardId', () => {
    const outcome: WeeklyServerOutcome = {
      weekKey: '2026-06-15',
      finalizedAt: NOW.toISOString(),
      rank: 2,
      weeklyBest: 4_200,
      runsCount: 3,
      achievedAt: NOW.toISOString(),
      reward: { rewardId: 'weekly:reward-2', prize: WEEKLY_PRIZES[2] },
      receipt: null,
    };
    expect(weeklyPrizeRecordFromOutcome(outcome)).toMatchObject({
      rewardId: 'weekly:reward-2',
      weekKey: '2026-06-15',
      rank: 2,
      claimed: false,
      origin: 'server',
    });
    expect(weeklyPrizeRecordFromOutcome({ ...outcome, reward: null })).toBeNull();
  });

  it('preserves claimed legacy rewards without replaying them through G03', () => {
    expect(normalizeWeeklyPrizeRecord({
      weekKey: '2026-06-08',
      rank: 1,
      prize: WEEKLY_PRIZES[1],
      claimed: true,
      earnedAt: NOW.toISOString(),
    })).toMatchObject({
      origin: 'legacy_local',
      claimed: true,
      localAppliedAt: NOW.toISOString(),
    });
  });
});

describe('unclaimedPrize / championRankOf', () => {
  const records: WeeklyPrizeRecord[] = [
    { rewardId: 'r3', weekKey: '2026-06-01', rank: 3, prize: WEEKLY_PRIZES[3], claimed: true, earnedAt: NOW.toISOString(), receipt: null, origin: 'server', localAppliedAt: NOW.toISOString() },
    { rewardId: 'r1', weekKey: '2026-06-08', rank: 1, prize: WEEKLY_PRIZES[1], claimed: false, earnedAt: NOW.toISOString(), receipt: null, origin: 'server', localAppliedAt: null },
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
