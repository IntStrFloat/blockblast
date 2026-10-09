import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';
import { recordNextGoalCompletion, useAnalyticsStore } from '@/features/analytics';

import { getUtcWeekWindow } from './week';

export interface WeeklyGoalRecord {
  goalId: string;
  weekKey: string;
  target: number;
  progress: number;
  assignedAt: number;
  completedAt: number | null;
}

interface WeeklyGoalState {
  goals: WeeklyGoalRecord[];
  sync: (
    now: Date,
    current: number,
    source?: 'home_card' | 'cached' | 'leaderboard',
    previousAchieved?: number,
  ) => WeeklyGoalRecord;
  advanceCompleted: (now: Date, current: number) => WeeklyGoalRecord;
  expose: (
    goal: WeeklyGoalRecord,
    source: 'home_card' | 'cached' | 'leaderboard',
  ) => void;
  hydrate: () => void;
  reset: () => void;
}

function initialGoals(): WeeklyGoalRecord[] {
  const saved = getJSON<WeeklyGoalRecord[]>(KEYS.leaderboardGoals);
  return Array.isArray(saved) ? saved : [];
}

function assignedTarget(previous: WeeklyGoalRecord | undefined): number {
  if (!previous) return 1_500;
  const achievedStage = Math.floor(Math.max(0, previous.progress) / 500) * 500;
  return Math.max(1_500, achievedStage + 500);
}

function assignmentBaseline(
  previous: WeeklyGoalRecord | undefined,
  previousAchieved: number,
): WeeklyGoalRecord | undefined {
  const progress = Math.max(previous?.progress ?? 0, Math.max(0, previousAchieved));
  if (!previous && progress === 0) return undefined;
  return previous
    ? { ...previous, progress }
    : {
        goalId: 'migration-baseline',
        weekKey: '',
        target: 0,
        progress,
        assignedAt: 0,
        completedAt: null,
      };
}

function activeGoalForWeek(
  goals: readonly WeeklyGoalRecord[],
  weekKey: string,
): WeeklyGoalRecord | undefined {
  return [...goals].reverse().find((goal) => goal.weekKey === weekKey);
}

function persistGoals(goals: WeeklyGoalRecord[]): void {
  setJSON(KEYS.leaderboardGoals, goals);
}

function trackAssigned(goal: WeeklyGoalRecord): void {
  useAnalyticsStore.getState().trackOnce(
    `weekly-goal-assigned:${goal.goalId}`,
    'weekly_goal_assigned',
    { goal_id: goal.goalId, week_key: goal.weekKey, target: goal.target },
  );
}

export const useWeeklyGoalStore = create<WeeklyGoalState>((set, get) => ({
  goals: initialGoals(),

  sync(now, current, source = 'leaderboard', previousAchieved = 0) {
    const weekKey = getUtcWeekWindow(now).weekKey;
    const progress = Math.max(0, Math.floor(current));
    const existing = activeGoalForWeek(get().goals, weekKey);
    if (!existing) {
      const previous = [...get().goals]
        .reverse()
        .find((goal) => goal.weekKey < weekKey);
      const migrationBaseline = assignmentBaseline(previous, previousAchieved);
      const target = assignedTarget(migrationBaseline);
      const assigned: WeeklyGoalRecord = {
        goalId: `weekly:${weekKey}:${target}`,
        weekKey,
        target,
        progress,
        assignedAt: now.getTime(),
        completedAt: progress >= target ? now.getTime() : null,
      };
      const goals = [...get().goals, assigned];
      set({ goals });
      persistGoals(goals);
      trackAssigned(assigned);
      if (assigned.completedAt) {
        recordNextGoalCompletion('weekly', assigned.goalId);
        useAnalyticsStore.getState().trackOnce(
          `weekly-goal-completed:${assigned.goalId}`,
          'weekly_goal_completed',
          {
            source,
            goal_id: assigned.goalId,
            week_key: weekKey,
            current: progress,
            target,
          },
        );
      }
      return assigned;
    }

    const nextProgress = Math.max(existing.progress, progress);
    const completedAt = existing.completedAt ?? (nextProgress >= existing.target ? now.getTime() : null);
    if (existing.progress === nextProgress && existing.completedAt === completedAt) return existing;
    const updated = { ...existing, progress: nextProgress, completedAt };
    const goals = get().goals.map((goal) => (goal.goalId === existing.goalId ? updated : goal));
    set({ goals });
    persistGoals(goals);
    if (!existing.completedAt && completedAt) {
      recordNextGoalCompletion('weekly', existing.goalId);
      useAnalyticsStore.getState().trackOnce(
        `weekly-goal-completed:${existing.goalId}`,
        'weekly_goal_completed',
        {
          source,
          goal_id: existing.goalId,
          week_key: existing.weekKey,
          current: nextProgress,
          target: existing.target,
        },
      );
    }
    return updated;
  },

  advanceCompleted(now, current) {
    const weekKey = getUtcWeekWindow(now).weekKey;
    const existing = activeGoalForWeek(get().goals, weekKey) ?? get().sync(now, current);
    if (!existing.completedAt) return existing;

    const progress = Math.max(existing.progress, Math.max(0, Math.floor(current)));
    const target = assignedTarget({ ...existing, progress });
    const next: WeeklyGoalRecord = {
      goalId: `weekly:${weekKey}:${target}`,
      weekKey,
      target,
      progress,
      assignedAt: now.getTime(),
      completedAt: null,
    };
    const goals = [...get().goals, next];
    set({ goals });
    persistGoals(goals);
    trackAssigned(next);
    return next;
  },

  expose(goal, source) {
    useAnalyticsStore.getState().trackOnce(
      `weekly-goal-exposed:${goal.goalId}:${source}`,
      'weekly_goal_exposed',
      {
        source,
        goal_id: goal.goalId,
        week_key: goal.weekKey,
        current: goal.progress,
        target: goal.target,
      },
    );
  },

  hydrate() {
    set({ goals: initialGoals() });
  },

  reset() {
    set({ goals: [] });
    setJSON(KEYS.leaderboardGoals, []);
  },
}));

export function currentWeeklyGoal(
  goals: readonly WeeklyGoalRecord[],
  now = new Date(),
  current = 0,
  previousAchieved = 0,
): WeeklyGoalRecord {
  const weekKey = getUtcWeekWindow(now).weekKey;
  const existing = activeGoalForWeek(goals, weekKey);
  if (existing) return existing;
  const previous = [...goals]
    .reverse()
    .find((goal) => goal.weekKey < weekKey);
  const migrationBaseline = assignmentBaseline(previous, previousAchieved);
  const target = assignedTarget(migrationBaseline);
  const progress = Math.max(0, Math.floor(current));
  return {
    goalId: `weekly:${weekKey}:${target}`,
    weekKey,
    target,
    progress,
    assignedAt: now.getTime(),
    completedAt: progress >= target ? now.getTime() : null,
  };
}
