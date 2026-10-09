import { KEYS, getJSON, removeKey, setJSON } from '@/core/storage';

import { createAnalyticsStore } from '../store';
import type { AnalyticsTransport } from '../transport';
import type { AnalyticsCommonContext } from '../types';

function createTransport(): jest.Mocked<AnalyticsTransport> {
  return {
    initialize: jest.fn(),
    reportEvent: jest.fn(),
    sendEventsBuffer: jest.fn(),
    setDataSendingEnabled: jest.fn(),
  };
}

function context(overrides: Partial<AnalyticsCommonContext> = {}): AnalyticsCommonContext {
  return {
    schema_version: 2,
    config_version: 'retention-diagnostics-1',
    session_id: 'session-1',
    product_session_id: 'session-1',
    session_index: 1,
    app_version: '1.1.38',
    build_number: '45',
    platform: 'android',
    locale: 'ru-RU',
    games_played: 4,
    lifetime_games: 4,
    session_games: 0,
    is_first_session: false,
    entry_source: 'organic',
    first_launch_version: '1.1.35',
    install_state: 'updated_install',
    device_class: 'phone',
    ...overrides,
  };
}

beforeEach(() => {
  removeKey(KEYS.analyticsQueue);
  removeKey(KEYS.analyticsPrefs);
  removeKey(KEYS.analyticsSessionMeta);
  removeKey(KEYS.analyticsRuntime);
  removeKey(KEYS.analyticsExperiments);
});

describe('analytics event envelopes', () => {
  it('freezes event, run and product-session context across offline retry, restart and update', () => {
    const offline = createTransport();
    offline.reportEvent.mockImplementation(() => {
      throw new Error('offline');
    });
    const first = createAnalyticsStore({ now: () => 100, idFactory: () => 'event-1', transport: offline });
    first.getState().initialize(context());
    first.getState().startRun('classic', 'new', 'run-1');
    first.getState().track('play_tapped', { source: 'home', has_saved_game: false });

    const queued = first.getState().queue.find((event) => event.name === 'play_tapped');
    expect(queued).toMatchObject({ event_id: 'event-1', run_id: 'run-1', context: context() });

    const online = createTransport();
    const restarted = createAnalyticsStore({ now: () => 200, idFactory: () => 'event-2', transport: online });
    restarted.getState().initialize(context({
      session_id: 'session-2',
      product_session_id: 'session-2',
      app_version: '1.1.39',
      build_number: '46',
    }));

    expect(online.reportEvent).toHaveBeenCalledWith(
      'play_tapped',
      expect.objectContaining({
        event_id: 'event-1',
        run_id: 'run-1',
        session_id: 'session-1',
        app_version: '1.1.38',
        build_number: '45',
        event_timestamp_ms: 100,
      }),
    );
    expect(restarted.getState().queue).toEqual([]);
  });

  it('preserves pre-context events as explicitly unattributed instead of backfilling a later session', () => {
    const transport = createTransport();
    transport.reportEvent.mockImplementationOnce(() => {
      throw new Error('not initialized');
    });
    const store = createAnalyticsStore({ now: () => 123, idFactory: () => 'bootstrap-event', transport });
    store.getState().track('notification_opened', { kind: 'streak', origin: 'local' });
    store.getState().initialize(context());

    expect(transport.reportEvent).toHaveBeenLastCalledWith(
      'notification_opened',
      expect.objectContaining({
        event_id: 'bootstrap-event',
        context_status: 'bootstrap_unattributed',
        bootstrap_policy: 'preserve_without_historical_attribution',
      }),
    );
    const replayPayload = transport.reportEvent.mock.calls.at(-1)?.[1];
    expect(replayPayload).not.toHaveProperty('session_id');
    expect(replayPayload).not.toHaveProperty('app_version');
  });

  it('migrates legacy queued events without inventing historical attribution', () => {
    const legacy = [{ name: 'leaderboard_opened', properties: { source: 'screen' }, timestamp: 77 }];
    const offline = createTransport();
    offline.reportEvent.mockImplementation(() => { throw new Error('offline'); });
    const seed = createAnalyticsStore({ transport: offline });
    seed.setState({ queue: legacy as never });
    // Simulate the exact legacy on-disk shape.
    const storageModule = jest.requireActual('@/core/storage') as typeof import('@/core/storage');
    storageModule.setJSON(KEYS.analyticsQueue, legacy);

    const transport = createTransport();
    const migrated = createAnalyticsStore({ transport });
    migrated.getState().initialize(context());
    expect(transport.reportEvent).toHaveBeenCalledWith(
      'leaderboard_opened',
      expect.objectContaining({ event_id: 'legacy-77-0', context_status: 'bootstrap_unattributed' }),
    );
    expect(transport.reportEvent.mock.calls[0]?.[1]).not.toHaveProperty('session_id');
  });

  it('opt-out clears persisted backlog, run state and blocks future events', () => {
    const transport = createTransport();
    transport.reportEvent.mockImplementation(() => { throw new Error('offline'); });
    const store = createAnalyticsStore({ transport });
    setJSON(KEYS.analyticsSessionMeta, { sessionIndex: 1, activeContext: context() });
    store.getState().initialize(context());
    store.getState().startRun('classic', 'new', 'run-1');
    store.getState().track('leaderboard_opened', { source: 'home_card' });
    store.getState().setOptOut(true);
    store.getState().track('daily_challenge_started', { source: 'home_card' });

    expect(store.getState().queue).toEqual([]);
    expect(store.getState().activeRun).toBeNull();
    expect(getJSON<Record<string, unknown>>(KEYS.analyticsSessionMeta)).not.toHaveProperty('activeContext');
    expect(getJSON(KEYS.analyticsPrefs)).toEqual({ optOut: true });
    expect(transport.setDataSendingEnabled).toHaveBeenCalledWith(false);
  });
});

describe('run attribution and dedupe', () => {
  it('counts active duration only while the run is active and caps placement telemetry', () => {
    let time = 1_000;
    let sequence = 0;
    const transport = createTransport();
    const store = createAnalyticsStore({ now: () => time, idFactory: () => `id-${++sequence}`, transport });
    store.getState().initialize(context());
    store.getState().startRun('classic', 'new', 'run-1');
    time = 2_000;
    store.getState().recordPlacement({ mode: 'classic', guidance: 'guided', clearedLines: 1 });
    store.getState().pauseRun();
    time = 20_000;
    store.getState().resumeRun('classic', 'saved');
    time = 21_000;
    for (let index = 0; index < 4; index += 1) {
      store.getState().recordPlacement({
        mode: 'classic',
        guidance: 'independent',
        clearedLines: index === 0 ? 1 : 0,
      });
    }
    store.getState().finishRun({ mode: 'classic', result: 'completed', reason: 'game_over', score: 50 });

    const result = transport.reportEvent.mock.calls.find(([name]) => name === 'run_result')?.[1];
    expect(result).toEqual(expect.objectContaining({
      run_id: 'run-1',
      active_duration_ms: 2_000,
      placements: 5,
      reason: 'game_over',
    }));
    expect(transport.reportEvent.mock.calls.filter(([name]) => name === 'piece_accepted')).toHaveLength(5);
    expect(transport.reportEvent.mock.calls.filter(([name]) => name === 'first_guided_clear')).toHaveLength(1);
    expect(transport.reportEvent.mock.calls.filter(([name]) => name === 'first_independent_clear')).toHaveLength(1);
  });

  it('does not duplicate a terminal result after process death or repeated mount', () => {
    const firstTransport = createTransport();
    const first = createAnalyticsStore({ now: () => 100, idFactory: () => 'event-1', transport: firstTransport });
    first.getState().initialize(context());
    first.getState().startRun('adventure', 'new', 'run-a');
    expect(first.getState().finishRun({ mode: 'adventure', result: 'completed', reason: 'level_won' })).toBe(true);

    const secondTransport = createTransport();
    const restarted = createAnalyticsStore({ now: () => 200, idFactory: () => 'event-2', transport: secondTransport });
    restarted.getState().initialize(context({ session_id: 'session-2', product_session_id: 'session-2' }));
    expect(restarted.getState().finishRun({ mode: 'adventure', result: 'completed', reason: 'level_won' })).toBe(false);
    expect(secondTransport.reportEvent.mock.calls.filter(([name]) => name === 'run_result')).toHaveLength(0);
  });

  it('persists trackOnce keys before reporting so rewards survive crash boundaries', () => {
    const first = createAnalyticsStore({ idFactory: () => 'reward-event', transport: createTransport() });
    first.getState().initialize(context());
    first.getState().startRun('classic', 'new', 'run-1');
    expect(first.getState().trackOnce('reward:run-1', 'reward_granted', { reward_type: 'xp', amount: 10 })).toBe('reward-event');

    const restarted = createAnalyticsStore({ idFactory: () => 'duplicate', transport: createTransport() });
    expect(restarted.getState().trackOnce('reward:run-1', 'reward_granted', { reward_type: 'xp', amount: 10 })).toBeNull();
  });

  it('revises a revived result under the same run id without double-counting the game', () => {
    let time = 100;
    let id = 0;
    const transport = createTransport();
    const store = createAnalyticsStore({ now: () => time, idFactory: () => `event-${++id}`, transport });
    store.getState().initialize(context({ lifetime_games: 4, games_played: 4 }));
    store.getState().startRun('classic', 'new', 'run-revive');
    store.getState().recordPlacement({ mode: 'classic', guidance: 'independent', clearedLines: 2 });
    store.getState().finishRun({ mode: 'classic', result: 'completed', reason: 'game_over', score: 50 });
    time = 200;
    expect(store.getState().resumeRun('classic', 'revive')).toBe('run-revive');
    store.getState().recordPlacement({ mode: 'classic', guidance: 'independent', clearedLines: 1 });
    store.getState().finishRun({ mode: 'classic', result: 'completed', reason: 'game_over', score: 80 });

    const results = transport.reportEvent.mock.calls.filter(([name]) => name === 'run_result').map(([, payload]) => payload);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({ run_id: 'run-revive', lines: 2, score: 50 }));
    expect(results[1]).toEqual(expect.objectContaining({ run_id: 'run-revive', lines: 3, score: 80 }));
    expect(store.getState().context).toEqual(expect.objectContaining({ lifetime_games: 5, session_games: 1 }));
  });

  it('emits run_resumed only for a paused-to-active transition', () => {
    const transport = createTransport();
    const store = createAnalyticsStore({ transport });
    store.getState().initialize(context());
    store.getState().startRun('adventure', 'new', 'run-1');
    store.getState().resumeRun('adventure', 'saved');
    expect(transport.reportEvent.mock.calls.filter(([name]) => name === 'run_resumed')).toHaveLength(0);
    store.getState().pauseRun();
    store.getState().resumeRun('adventure', 'saved');
    expect(transport.reportEvent.mock.calls.filter(([name]) => name === 'run_resumed')).toHaveLength(1);
  });
});
