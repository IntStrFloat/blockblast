import { createRemoteTapDedupeState, shouldHandleRemoteTap } from '../remoteTapDedupe';

describe('remote notification tap dedupe', () => {
  it('deduplicates stable message ids for the process lifetime', () => {
    const state = createRemoteTapDedupeState();
    const tap = { id: 'push-1', kind: 'weekly', route: '/leaderboard' };

    expect(shouldHandleRemoteTap(tap, state, 1_000)).toBe(true);
    expect(shouldHandleRemoteTap(tap, state, 50_000)).toBe(false);
  });

  it('deduplicates idless startup/listener delivery only inside a short window', () => {
    const state = createRemoteTapDedupeState();
    const tap = { id: null, kind: 'unknown', route: '/leaderboard' };

    expect(shouldHandleRemoteTap(tap, state, 1_000)).toBe(true);
    expect(shouldHandleRemoteTap(tap, state, 2_000)).toBe(false);
    expect(shouldHandleRemoteTap(tap, state, 3_001)).toBe(true);
  });

  it('does not merge different idless routes or kinds', () => {
    const state = createRemoteTapDedupeState();

    expect(
      shouldHandleRemoteTap({ id: null, kind: 'weekly', route: '/leaderboard' }, state, 1_000),
    ).toBe(true);
    expect(
      shouldHandleRemoteTap({ id: null, kind: 'season', route: '/adventure' }, state, 1_001),
    ).toBe(true);
  });
});
