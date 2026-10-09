import { selectNextAction, type NextActionState } from '../nextAction';

function state(overrides: Partial<NextActionState> = {}): NextActionState {
  return {
    gamesPlayed: 0,
    resume: null,
    reward: {
      available: true, goalId: 'reward:hint', current: 1000, target: 2000,
      complete: false, rewardId: 'hint', rewardKind: 'helper', level: 2, availableNow: false,
    },
    weekly: {
      available: true, goalId: 'weekly:w:1500', weekKey: 'w', current: 0,
      target: 1500, complete: false,
    },
    ...overrides,
  };
}

describe('selectNextAction', () => {
  it('prioritizes the selected unfinished run with measurable progress', () => {
    const selected = selectNextAction(state({
      gamesPlayed: 4,
      resume: {
        available: true, mode: 'adventure', goalId: 'run:a1', current: 4, target: 7,
        complete: false, level: 3, savedState: 'active',
      },
    }));
    expect(selected).toMatchObject({
      kind: 'resume', mode: 'adventure', level: 3, remaining: 3, goalId: 'run:a1',
    });
  });

  it.each([0, 3, 4, 20])('never drops the goal at gamesPlayed=%i', (gamesPlayed) => {
    expect(selectNextAction(state({ gamesPlayed })).kind).toBe('reward');
  });

  it('falls back to the fixed weekly goal after current-section rewards are open', () => {
    expect(selectNextAction(state({ reward: null }))).toMatchObject({
      kind: 'weekly', goalId: 'weekly:w:1500', target: 1500, remaining: 1500,
    });
  });
});
