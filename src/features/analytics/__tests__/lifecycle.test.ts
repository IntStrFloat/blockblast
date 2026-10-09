import { KEYS, getJSON, removeKey, setJSON } from '@/core/storage';

import {
  PRODUCT_SESSION_TIMEOUT_MS,
  pauseProductSession,
  resolveProductSession,
} from '../lifecycle';

beforeEach(() => removeKey(KEYS.analyticsSessionMeta));

const input = (now: number, version = '1.1.38') => ({
  now,
  appVersion: version,
  buildNumber: version === '1.1.38' ? '45' : '46',
  platform: 'android',
  locale: 'ru-RU',
  deviceClass: 'phone' as const,
  lifetimeGames: 3,
  entrySource: 'organic' as const,
  idFactory: () => `session-${now}`,
});

describe('product session lifecycle', () => {
  it('treats a short background as pause while AppMetrica SDK sessions remain separate', () => {
    const started = resolveProductSession(input(1_000));
    expect(started.kind).toBe('started');
    pauseProductSession(2_000);
    const resumed = resolveProductSession(input(2_000 + PRODUCT_SESSION_TIMEOUT_MS - 1));
    expect(resumed).toMatchObject({ kind: 'resumed', pausedDurationMs: PRODUCT_SESSION_TIMEOUT_MS - 1 });
    expect(resumed.context.session_id).toBe(started.context.session_id);
  });

  it('starts a new product session after the timeout and reports the previous context explicitly', () => {
    const started = resolveProductSession(input(1_000));
    pauseProductSession(2_000);
    const next = resolveProductSession(input(2_000 + PRODUCT_SESSION_TIMEOUT_MS));
    expect(next.kind).toBe('started');
    if (next.kind !== 'started') throw new Error('expected started');
    expect(next.previous).toMatchObject({ reason: 'background_timeout', context: started.context });
    expect(next.context.session_id).not.toBe(started.context.session_id);
    expect(next.context.session_index).toBe(2);
  });

  it('separates an update from a new install and preserves first-launch version', () => {
    const first = resolveProductSession(input(1_000));
    expect(first.context.install_state).toBe('new_install');
    pauseProductSession(2_000);
    const updated = resolveProductSession(input(2_000 + PRODUCT_SESSION_TIMEOUT_MS, '1.1.39'));
    expect(updated.context.install_state).toBe('updated_install');
    expect(updated.context.first_launch_version).toBe('1.1.38');
    expect(getJSON<Record<string, unknown>>(KEYS.analyticsSessionMeta)).toMatchObject({
      firstLaunchVersion: '1.1.38',
      lastSeenVersion: '1.1.39',
    });
  });

  it('uses process_death when no background timestamp was persisted', () => {
    const first = resolveProductSession(input(1_000));
    const revived = resolveProductSession(input(2_000));
    expect(revived.kind).toBe('started');
    if (revived.kind !== 'started') throw new Error('expected started');
    expect(revived.previous).toMatchObject({ reason: 'process_death', context: first.context });
  });

  it('carries lifetime runs across sessions even when the legacy score counter is lower', () => {
    const first = resolveProductSession(input(1_000));
    const stored = getJSON<Record<string, unknown>>(KEYS.analyticsSessionMeta)!;
    setJSON(KEYS.analyticsSessionMeta, {
      ...stored,
      activeContext: { ...first.context, lifetime_games: 9, games_played: 9 },
      backgroundedAt: 2_000,
    });
    const next = resolveProductSession(input(2_000 + PRODUCT_SESSION_TIMEOUT_MS));
    expect(next.context.lifetime_games).toBe(9);
  });

  it('does not invent first-launch attribution for legacy session metadata', () => {
    setJSON(KEYS.analyticsSessionMeta, { sessionIndex: 7 });
    const migrated = resolveProductSession(input(1_000));
    expect(migrated.context.first_launch_version).toBe('unknown');
    expect(migrated.context.install_state).toBe('unknown');
  });
});
