import { KEYS, getJSON, removeKey } from '@/core/storage';

import { createAnalyticsStore } from '../store';

beforeEach(() => {
  removeKey(KEYS.analyticsQueue);
  removeKey(KEYS.analyticsPrefs);
});

describe('analytics store', () => {
  it('queues typed events by default and persists them locally', () => {
    const store = createAnalyticsStore({ now: () => 1234 });

    store.getState().track('leaderboard_opened', { source: 'home_card' });

    expect(store.getState().queue).toEqual([
      {
        name: 'leaderboard_opened',
        properties: { source: 'home_card' },
        timestamp: 1234,
      },
    ]);
    expect(getJSON(KEYS.analyticsQueue)).toEqual(store.getState().queue);
  });

  it('opt-out clears unsent events and blocks future tracking', () => {
    const store = createAnalyticsStore({ now: () => 1234 });

    store.getState().track('leaderboard_opened', { source: 'home_card' });
    store.getState().setOptOut(true);
    store.getState().track('daily_challenge_started', { source: 'home_card' });

    expect(store.getState().optOut).toBe(true);
    expect(store.getState().queue).toEqual([]);
    expect(getJSON(KEYS.analyticsPrefs)).toEqual({ optOut: true });
  });
});
