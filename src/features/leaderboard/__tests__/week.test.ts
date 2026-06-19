import {
  createChallengeCode,
  createDailyChallenge,
  decodeChallengeCode,
  getUtcWeekCountdown,
  getUtcWeekWindow,
  getVisibleLeaderboardEntry,
  getVisibleWeeklyBest,
  getWeeklyGoal,
  shouldShowDailyChallenge,
} from '../week';

describe('leaderboard week helpers', () => {
  it('calculates the UTC week boundary from Monday midnight', () => {
    expect(getUtcWeekWindow(new Date('2026-06-10T12:34:56.000Z'))).toEqual({
      weekKey: '2026-06-08',
      weekStartIso: '2026-06-08T00:00:00.000Z',
      weekEndIso: '2026-06-15T00:00:00.000Z',
    });
  });

  it('counts down to the next UTC week reset', () => {
    expect(getUtcWeekCountdown(new Date('2026-06-14T23:59:30.000Z'))).toEqual({
      totalMs: 30000,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 30,
    });
  });

  it('derives a deterministic daily challenge and round-trips its code', () => {
    const challenge = createDailyChallenge('2026-06-13');
    expect(challenge).toEqual({
      dateIso: '2026-06-13',
      seed: 1670,
      code: '260613-1AA',
    });
    expect(decodeChallengeCode(createChallengeCode(challenge.dateIso, challenge.seed))).toEqual(
      challenge,
    );
  });

  it('shows the daily challenge only after three completed games', () => {
    expect(shouldShowDailyChallenge(2)).toBe(false);
    expect(shouldShowDailyChallenge(3)).toBe(true);
  });

  it('derives a gentle weekly goal from the current weekly best', () => {
    expect(getWeeklyGoal(0)).toEqual({ current: 0, target: 1500, progress: 0 });
    expect(getWeeklyGoal(2480)).toEqual({ current: 2480, target: 3000, progress: 2480 });
  });

  it('uses the current local weekly best while remote sync is behind', () => {
    expect(
      getVisibleWeeklyBest(
        1200,
        {
          weekKey: '2026-06-08',
          bestScore: 2480,
          runsCount: 2,
          achievedAt: '2026-06-13T12:00:00.000Z',
        },
        new Date('2026-06-14T12:00:00.000Z'),
      ),
    ).toBe(2480);
    expect(
      getVisibleWeeklyBest(
        1200,
        {
          weekKey: '2026-06-08',
          bestScore: 2480,
          runsCount: 2,
          achievedAt: '2026-06-13T12:00:00.000Z',
        },
        new Date('2026-06-15T12:00:00.000Z'),
      ),
    ).toBe(1200);
  });

  it('uses the current local weekly best for the current player row', () => {
    expect(
      getVisibleLeaderboardEntry(
        {
          nickname: 'LimeComet',
          tag: '00H',
          rank: 7,
          weeklyBest: 1200,
          runsCount: 2,
          achievedAt: '2026-06-13T11:00:00.000Z',
          isCurrentPlayer: true,
        },
        {
          weekKey: '2026-06-08',
          bestScore: 2480,
          runsCount: 3,
          achievedAt: '2026-06-13T12:00:00.000Z',
        },
        new Date('2026-06-14T12:00:00.000Z'),
      ).weeklyBest,
    ).toBe(2480);
  });
});
