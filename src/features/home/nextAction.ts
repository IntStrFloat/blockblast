export type NextActionKind = 'resume' | 'reward' | 'weekly';
export type NextActionMode = 'classic' | 'adventure';

interface MeasurableGoal {
  goalId: string;
  current: number;
  target: number;
  complete: boolean;
}

export interface NextActionState {
  gamesPlayed: number;
  resume: (MeasurableGoal & {
    available: boolean;
    mode: NextActionMode;
    level?: number;
    score?: number;
    savedState: 'active' | 'second_chance';
  }) | null;
  reward: (MeasurableGoal & {
    available: boolean;
    rewardId: string;
    rewardKind: 'cosmetic' | 'helper' | 'world';
    level: number;
    availableNow: boolean;
  }) | null;
  weekly: MeasurableGoal & { available: boolean; weekKey: string };
}

export interface NextAction {
  kind: NextActionKind;
  goalId: string;
  current: number;
  target: number;
  remaining: number;
  complete: boolean;
  mode?: NextActionMode;
  level?: number;
  score?: number;
  savedState?: 'active' | 'second_chance';
  rewardId?: string;
  rewardKind?: 'cosmetic' | 'helper' | 'world';
  availableNow?: boolean;
  weekKey?: string;
  /** True only on the first scheduled reveal of a feature. */
  isReveal: boolean;
}

function action(kind: NextActionKind, goal: MeasurableGoal, extra: Partial<NextAction> = {}): NextAction {
  return {
    kind,
    goalId: goal.goalId,
    current: goal.current,
    target: goal.target,
    remaining: Math.max(0, goal.target - goal.current),
    complete: goal.complete,
    isReveal: false,
    ...extra,
  };
}

/**
 * Selects the single retention card rendered below the Home primary CTA.
 *
 * A saved run always wins, followed by a concrete reward in the current world
 * and finally the durable weekly goal. `gamesPlayed` remains in the input for
 * analytics compatibility, but never creates the old 3–4 game dead zone.
 */
export function selectNextAction(state: NextActionState): NextAction {
  if (state.resume?.available && !state.resume.complete) {
    return action('resume', state.resume, {
      mode: state.resume.mode,
      level: state.resume.level,
      score: state.resume.score,
      savedState: state.resume.savedState,
    });
  }
  if (state.reward?.available && !state.reward.complete) {
    return action('reward', state.reward, {
      level: state.reward.level,
      rewardId: state.reward.rewardId,
      rewardKind: state.reward.rewardKind,
      availableNow: state.reward.availableNow,
    });
  }
  return action('weekly', state.weekly, { weekKey: state.weekly.weekKey });
}
