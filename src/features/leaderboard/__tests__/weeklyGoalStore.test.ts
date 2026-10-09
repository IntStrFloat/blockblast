import { KEYS, getJSON, setJSON } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';

import { currentWeeklyGoal, useWeeklyGoalStore } from '../weeklyGoalStore';

describe('weekly goal ledger', () => {
  beforeEach(() => useWeeklyGoalStore.getState().reset());

  it('does not move target when the weekly best approaches or reaches it', () => {
    const now = new Date('2026-09-16T12:00:00.000Z');
    expect(useWeeklyGoalStore.getState().sync(now, 0).target).toBe(1500);
    expect(useWeeklyGoalStore.getState().sync(now, 1000).target).toBe(1500);
    const completed = useWeeklyGoalStore.getState().sync(now, 1500);
    expect(completed.target).toBe(1500);
    expect(completed.completedAt).not.toBeNull();
  });

  it('assigns a new goal id on a new week and keeps completed history', () => {
    const first = useWeeklyGoalStore.getState().sync(new Date('2026-09-16T12:00:00.000Z'), 1500);
    const nextWeek = new Date('2026-09-23T12:00:00.000Z');
    const preview = currentWeeklyGoal(useWeeklyGoalStore.getState().goals, nextWeek, 0);
    const next = useWeeklyGoalStore.getState().sync(nextWeek, 0);
    expect(next.goalId).not.toBe(first.goalId);
    expect(next.goalId).toBe(preview.goalId);
    expect(next.target).toBe(2000);
    expect(getJSON<unknown[]>(KEYS.leaderboardGoals)).toHaveLength(2);
  });

  it('uses the latest achieved stage when a week had multiple completed goals', () => {
    const firstWeek = new Date('2026-09-16T12:00:00.000Z');
    useWeeklyGoalStore.getState().sync(firstWeek, 1_500);
    useWeeklyGoalStore.getState().advanceCompleted(firstWeek, 1_500);
    useWeeklyGoalStore.getState().sync(firstWeek, 2_200);

    const nextWeek = useWeeklyGoalStore.getState().sync(
      new Date('2026-09-23T12:00:00.000Z'),
      0,
    );

    expect(nextWeek.target).toBe(2_500);
  });

  it('keeps progress monotonic across large, repeated, and stale results', () => {
    const now = new Date('2026-09-16T12:00:00.000Z');
    const initial = useWeeklyGoalStore.getState().sync(now, 0);
    const jumped = useWeeklyGoalStore.getState().sync(now, 5_200);
    const repeated = useWeeklyGoalStore.getState().sync(now, 5_200);
    const stale = useWeeklyGoalStore.getState().sync(now, 1_000);

    expect(jumped).toMatchObject({
      goalId: initial.goalId,
      target: 1_500,
      progress: 5_200,
    });
    expect(jumped.completedAt).not.toBeNull();
    expect(repeated).toEqual(jumped);
    expect(stale).toEqual(jumped);
    expect(useWeeklyGoalStore.getState().goals).toHaveLength(1);
  });

  it('moves to the next same-week stage only after an explicit completed transition', () => {
    const now = new Date('2026-09-16T12:00:00.000Z');
    const completed = useWeeklyGoalStore.getState().sync(now, 1_500);

    expect(currentWeeklyGoal(useWeeklyGoalStore.getState().goals, now)).toEqual(completed);

    const next = useWeeklyGoalStore.getState().advanceCompleted(now, 1_500);
    expect(next).toMatchObject({
      weekKey: completed.weekKey,
      target: 2_000,
      progress: 1_500,
      completedAt: null,
    });
    expect(next.goalId).not.toBe(completed.goalId);
    expect(useWeeklyGoalStore.getState().goals).toEqual([completed, next]);
    expect(useWeeklyGoalStore.getState().advanceCompleted(now, 1_500)).toEqual(next);
  });

  it('sizes a first-ledger returning goal from a persisted previous achieved stage', () => {
    const now = new Date('2026-09-23T12:00:00.000Z');
    const preview = currentWeeklyGoal([], now, 0, 4_200);
    const assigned = useWeeklyGoalStore.getState().sync(now, 0, 'home_card', 4_200);

    expect(preview.target).toBe(4_500);
    expect(assigned).toMatchObject({ goalId: preview.goalId, target: 4_500, progress: 0 });
  });

  it('prefers a newer closed-week best over an older lower ledger stage', () => {
    useWeeklyGoalStore.setState({ goals: [{
      goalId: 'weekly:2026-09-07:1500',
      weekKey: '2026-09-07',
      target: 1_500,
      progress: 1_500,
      assignedAt: 1,
      completedAt: 2,
    }] });
    const now = new Date('2026-09-23T12:00:00.000Z');

    const preview = currentWeeklyGoal(useWeeklyGoalStore.getState().goals, now, 0, 9_000);
    const assigned = useWeeklyGoalStore.getState().sync(now, 0, 'leaderboard', 9_000);

    expect(preview.target).toBe(9_500);
    expect(assigned.target).toBe(9_500);
  });

  it('hydrates the immutable goal id, target, progress, and completion from storage', () => {
    const saved = [{
      goalId: 'weekly:2026-09-14:1500',
      weekKey: '2026-09-14',
      target: 1_500,
      progress: 1_500,
      assignedAt: 10,
      completedAt: 20,
    }];
    setJSON(KEYS.leaderboardGoals, saved);
    useWeeklyGoalStore.setState({ goals: [] });

    useWeeklyGoalStore.getState().hydrate();

    expect(useWeeklyGoalStore.getState().goals).toEqual(saved);
  });

  it('uses one goal id and target for assigned, exposed, and completed metrics', () => {
    const trackOnce = jest.spyOn(useAnalyticsStore.getState(), 'trackOnce');
    const now = new Date('2026-09-16T12:00:00.000Z');
    const assigned = useWeeklyGoalStore.getState().sync(now, 0, 'home_card');
    useWeeklyGoalStore.getState().expose(assigned, 'home_card');
    useWeeklyGoalStore.getState().sync(now, 1_500, 'home_card');
    useWeeklyGoalStore.getState().sync(now, 1_500, 'home_card');

    const relevant = trackOnce.mock.calls.filter(([, name]) =>
      ['weekly_goal_assigned', 'weekly_goal_exposed', 'weekly_goal_completed'].includes(name),
    );
    expect(relevant).toEqual(expect.arrayContaining([
      expect.arrayContaining([
        expect.any(String),
        'weekly_goal_assigned',
        expect.objectContaining({ goal_id: assigned.goalId, target: 1_500 }),
      ]),
      expect.arrayContaining([
        expect.any(String),
        'weekly_goal_exposed',
        expect.objectContaining({ goal_id: assigned.goalId, target: 1_500 }),
      ]),
      expect.arrayContaining([
        expect.any(String),
        'weekly_goal_completed',
        expect.objectContaining({ goal_id: assigned.goalId, target: 1_500, source: 'home_card' }),
      ]),
    ]));
    expect(relevant.filter(([, name]) => name === 'weekly_goal_completed')).toHaveLength(1);
    trackOnce.mockRestore();
  });
});
