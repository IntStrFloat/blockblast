import { selectNextAction, type NextActionState } from '../nextAction';

function state(overrides: Partial<NextActionState> = {}): NextActionState {
  return {
    gamesPlayed: 0,
    adventure: { available: true, complete: false },
    leaderboard: { available: true, complete: false },
    ...overrides,
  };
}

describe('selectNextAction', () => {
  it.each([
    [1, 'adventure'],
    [2, 'leaderboard'],
  ] as const)('reveals only the scheduled feature after game %i', (gamesPlayed, kind) => {
    expect(selectNextAction(state({ gamesPlayed }))).toEqual({ kind, isReveal: true });
  });

  it('keeps game zero and the game-four cooldown free of retention cards', () => {
    expect(selectNextAction(state({ gamesPlayed: 0 }))).toBeNull();
    expect(selectNextAction(state({ gamesPlayed: 4 }))).toBeNull();
  });

  it('uses Adventure, then leaderboard priority from game five onward', () => {
    expect(selectNextAction(state({ gamesPlayed: 5 }))?.kind).toBe('adventure');
    expect(
      selectNextAction(
        state({
          gamesPlayed: 5,
          adventure: { available: true, complete: true },
        }),
      )?.kind,
    ).toBe('leaderboard');
  });

  it('does not select unavailable or completed goals in steady state', () => {
    expect(
      selectNextAction(
        state({
          gamesPlayed: 8,
          adventure: { available: true, complete: true },
          leaderboard: { available: true, complete: true },
        }),
      ),
    ).toBeNull();
  });
});
