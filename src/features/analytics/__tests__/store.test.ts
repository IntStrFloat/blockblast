import { KEYS, getJSON, removeKey } from '@/core/storage';

import { createAnalyticsStore } from '../store';
import type { AnalyticsTransport } from '../transport';

function createTransport(): jest.Mocked<AnalyticsTransport> {
  return {
    initialize: jest.fn(),
    reportEvent: jest.fn(),
    sendEventsBuffer: jest.fn(),
    setDataSendingEnabled: jest.fn(),
  };
}

beforeEach(() => {
  removeKey(KEYS.analyticsQueue);
  removeKey(KEYS.analyticsPrefs);
});

describe('analytics store', () => {
  it('queues typed events by default and persists them locally', () => {
    const store = createAnalyticsStore({ now: () => 1234 });

    store.getState().track('ad_shown', { format: 'banner', placement: 'home' });

    expect(store.getState().queue).toEqual([
      {
        name: 'ad_shown',
        properties: { format: 'banner', placement: 'home' },
        timestamp: 1234,
      },
    ]);
    expect(getJSON(KEYS.analyticsQueue)).toEqual(store.getState().queue);
  });

  it('accepts the growth and monetization metric events needed by reports', () => {
    const store = createAnalyticsStore({ now: () => 1234 });

    store.getState().track('game_start', { mode: 'daily' });
    store.getState().track('game_over', {
      score: 120,
      linesCleared: 4,
      revived: false,
      sessionDepth: 1,
    });
    store.getState().track('revive_shown', { available: true });
    store.getState().track('revive_used', { result: 'rewarded' });
    store.getState().track('ad_requested', { format: 'interstitial', placement: 'gameover' });
    store.getState().track('ad_shown', { format: 'rewarded', placement: 'revive' });
    store.getState().track('ad_failed', {
      format: 'banner',
      placement: 'game',
      stage: 'load',
      message: 'network',
    });
    store.getState().track('daily_bonus_stage', {
      stage: 'firstWin',
      points: 750,
      multiplier: 1.5,
      day: 3,
    });
    store.getState().track('leaderboard_opened', { source: 'screen' });
    store.getState().track('session_depth', { gamesPlayed: 2 });

    expect(store.getState().queue.map((event) => event.name)).toEqual([
      'game_start',
      'game_over',
      'revive_shown',
      'revive_used',
      'ad_requested',
      'ad_shown',
      'ad_failed',
      'daily_bonus_stage',
      'leaderboard_opened',
      'session_depth',
    ]);
  });

  it('opt-out clears unsent events and blocks future tracking', () => {
    const transport = createTransport();
    const store = createAnalyticsStore({ now: () => 1234, transport });

    store.getState().track('leaderboard_opened', { source: 'home_card' });
    store.getState().setOptOut(true);
    store.getState().track('daily_challenge_started', { source: 'home_card' });

    expect(store.getState().optOut).toBe(true);
    expect(store.getState().queue).toEqual([]);
    expect(getJSON(KEYS.analyticsPrefs)).toEqual({ optOut: true });
    expect(transport.setDataSendingEnabled).toHaveBeenCalledWith(false);
  });

  it('attaches common context to transport events and flushes SDK buffer', () => {
    const transport = createTransport();
    const store = createAnalyticsStore({ now: () => 1234, transport });
    const context = {
      schema_version: 1 as const,
      session_id: 'session-1',
      session_index: 1,
      app_version: '1.1.27',
      build_number: '32',
      platform: 'android',
      locale: 'ru-RU',
      games_played: 0,
      is_first_session: true,
      entry_source: 'organic' as const,
    };

    store.getState().initialize(context);
    store.getState().track('play_tapped', {
      source: 'home',
      has_saved_game: false,
    });
    store.getState().flush();

    expect(transport.initialize).toHaveBeenCalledWith({ enabled: true });
    expect(transport.reportEvent).toHaveBeenCalledWith('play_tapped', {
      ...context,
      source: 'home',
      has_saved_game: false,
      event_timestamp_ms: 1234,
    });
    expect(transport.sendEventsBuffer).toHaveBeenCalledTimes(1);
  });

  it('bounds the persisted diagnostic queue to 200 events', () => {
    const store = createAnalyticsStore({ now: () => 1234, transport: createTransport() });

    for (let index = 0; index < 205; index += 1) {
      store.getState().track('session_depth', { gamesPlayed: index });
    }

    expect(store.getState().queue).toHaveLength(200);
    expect(store.getState().queue[0]).toEqual(
      expect.objectContaining({ properties: { gamesPlayed: 5 } }),
    );
  });
});
