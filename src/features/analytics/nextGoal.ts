import { KEYS, getJSON, removeKey, setJSON } from '@/core/storage';

import { useAnalyticsStore } from './store';
import type { AnalyticsGameMode } from './types';

interface PendingNextGoal {
  goalId: string;
  goalType: string;
  clickedAt: number;
}

export function recordNextGoalClick(goalType: string, goalId: string): void {
  useAnalyticsStore.getState().track('next_action_clicked', {
    kind: goalType,
    goal_id: goalId,
  });
  setJSON(KEYS.analyticsNextGoal, {
    goalId,
    goalType,
    clickedAt: Date.now(),
  } satisfies PendingNextGoal);
}

export function recordAttributedNextRun(mode: AnalyticsGameMode, now = Date.now()): void {
  const pending = getJSON<PendingNextGoal>(KEYS.analyticsNextGoal);
  if (!pending || now - pending.clickedAt > 7 * 24 * 60 * 60 * 1000) {
    removeKey(KEYS.analyticsNextGoal);
    return;
  }
  useAnalyticsStore.getState().trackOnce(
    `next-run:${pending.goalId}`,
    'next_run',
    { goal_type: pending.goalType, goal_id: pending.goalId, mode },
  );
  removeKey(KEYS.analyticsNextGoal);
}

export function recordNextGoalCompletion(goalType: string, goalId: string): void {
  useAnalyticsStore.getState().trackOnce(
    `next-goal-completed:${goalId}`,
    'next_goal_completed',
    { goal_type: goalType, goal_id: goalId },
  );
}
