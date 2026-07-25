import {
  getUtcWeekCountdown,
  getUtcWeekWindow,
  getWeeklyGoal,
} from '../week';

describe('leaderboard week helpers', () => {
  it('calculates the leaderboard week boundary from Monday midnight in Moscow time', () => {
    expect(getUtcWeekWindow(new Date('2026-06-10T12:34:56.000Z'))).toEqual({
      weekKey: '2026-06-08',
      weekStartIso: '2026-06-07T21:00:00.000Z',
      weekEndIso: '2026-06-14T21:00:00.000Z',
    });
  });

  it('rolls the leaderboard week at Monday midnight in Moscow time', () => {
    expect(getUtcWeekWindow(new Date('2026-07-05T20:59:59.000Z'))).toEqual({
      weekKey: '2026-06-29',
      weekStartIso: '2026-06-28T21:00:00.000Z',
      weekEndIso: '2026-07-05T21:00:00.000Z',
    });
    expect(getUtcWeekWindow(new Date('2026-07-05T21:00:00.000Z'))).toEqual({
      weekKey: '2026-07-06',
      weekStartIso: '2026-07-05T21:00:00.000Z',
      weekEndIso: '2026-07-12T21:00:00.000Z',
    });
  });

  it('counts down to the next UTC week reset', () => {
    expect(getUtcWeekCountdown(new Date('2026-07-05T20:59:30.000Z'))).toEqual({
      totalMs: 30000,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 30,
    });
  });

  it('derives a gentle weekly goal from the current weekly best', () => {
    expect(getWeeklyGoal(0)).toEqual({ current: 0, target: 1500, progress: 0 });
    expect(getWeeklyGoal(2480)).toEqual({ current: 2480, target: 3000, progress: 2480 });
  });

});
