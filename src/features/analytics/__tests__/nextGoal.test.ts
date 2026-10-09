import { KEYS, getJSON, removeKey } from '@/core/storage';

import { recordAttributedNextRun, recordNextGoalClick } from '../nextGoal';
import { useAnalyticsStore } from '../store';

describe('next-goal attribution', () => {
  beforeEach(() => {
    removeKey(KEYS.analyticsNextGoal);
    useAnalyticsStore.setState({ queue: [], optOut: false });
  });

  it('links exposure click attribution to the next actual run once', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    recordNextGoalClick('weekly', 'weekly:2026-09-14:1500');
    expect(getJSON(KEYS.analyticsNextGoal)).toMatchObject({
      goalId: 'weekly:2026-09-14:1500',
    });

    recordAttributedNextRun('classic', 1_100);
    expect(useAnalyticsStore.getState().queue.map((event) => event.name)).toEqual(
      expect.arrayContaining(['next_action_clicked', 'next_run']),
    );
    expect(getJSON(KEYS.analyticsNextGoal)).toBeNull();

    recordAttributedNextRun('classic', 1_200);
    expect(useAnalyticsStore.getState().queue.filter((event) => event.name === 'next_run')).toHaveLength(1);
    now.mockRestore();
  });

  it('does not attribute a stale click after seven days', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    recordNextGoalClick('reward', 'reward:2:hint');
    recordAttributedNextRun('classic', 1_000 + 8 * 24 * 60 * 60 * 1000);
    expect(useAnalyticsStore.getState().queue.some((event) => event.name === 'next_run')).toBe(false);
    now.mockRestore();
  });
});
