import { KEYS, getJSON, removeKey } from '@/core/storage';

import type { LeaderboardClient } from '@/features/leaderboard/client';

import { createGeneratedProfile } from '../nickname';
import { createProfileStore } from '../store';

beforeEach(() => {
  removeKey(KEYS.profileLocal);
  removeKey(KEYS.profileAuth);
});

describe('profile store', () => {
  it('bootstraps a persisted generated profile immediately', () => {
    const store = createProfileStore({ initialSeed: 7, autoBootstrap: false });

    expect(store.getState().profile).toEqual(createGeneratedProfile(7));
    expect(getJSON(KEYS.profileLocal)).toEqual(store.getState().profile);
  });

  it('rerolling explores more than six nickname combinations across twelve seeds', () => {
    const names = new Set(
      Array.from({ length: 12 }, (_, seed) => createGeneratedProfile(seed).nickname),
    );

    expect(names.size).toBeGreaterThan(6);
  });

  it('bootstrap accepts the server-owned tag', async () => {
    const bootstrapProfile = jest.fn(async () => ({
      profile: { nickname: 'LimeComet', tag: 'SRV' },
      authToken: 'token-123',
    }));
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      submitRun: async () => null,
    };

    const store = createProfileStore({ initialSeed: 7, client, autoBootstrap: false });
    await store.getState().bootstrapRemote();

    expect(store.getState().profile.tag).toBe('SRV');
    expect(store.getState().authToken).toBe('token-123');
    await store.getState().bootstrapRemote();
    expect(bootstrapProfile).toHaveBeenLastCalledWith({
      nickname: 'LimeComet',
      authToken: 'token-123',
    });
  });

  it('shares one in-flight bootstrap across concurrent callers', async () => {
    type BootstrapSession = {
      profile: { nickname: string; tag: string };
      authToken: string;
    };
    let resolveBootstrap: (session: BootstrapSession) => void = () => {
      throw new Error('bootstrap promise was not initialized');
    };
    const bootstrapProfile = jest.fn(
      () =>
        new Promise<BootstrapSession>((resolve) => {
          resolveBootstrap = resolve;
        }),
    );
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      submitRun: async () => null,
    };

    const store = createProfileStore({ initialSeed: 7, client, autoBootstrap: false });
    const first = store.getState().bootstrapRemote();
    const second = store.getState().bootstrapRemote();

    expect(bootstrapProfile).toHaveBeenCalledTimes(1);
    resolveBootstrap({
      profile: { nickname: 'LimeComet', tag: 'SRV' },
      authToken: 'token-123',
    });

    await expect(first).resolves.toEqual({
      profile: { nickname: 'LimeComet', tag: 'SRV' },
      authToken: 'token-123',
    });
    await expect(second).resolves.toEqual({
      profile: { nickname: 'LimeComet', tag: 'SRV' },
      authToken: 'token-123',
    });
    expect(store.getState().authToken).toBe('token-123');
  });

  it('rename waits for remote success and does not send or change the tag', async () => {
    const renameProfile = jest.fn(async ({ nickname }: { nickname: string }) => ({
      nickname,
      tag: 'SRV',
    }));
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => ({
        profile: { nickname: 'LimeComet', tag: 'SRV' },
        authToken: 'token-123',
      }),
      renameProfile,
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      submitRun: async () => null,
    };

    const store = createProfileStore({ initialSeed: 7, client, autoBootstrap: false });
    await store.getState().bootstrapRemote();
    const result = await store.getState().rename('Pixel Hero');

    expect(result).toEqual({ ok: true });
    expect(renameProfile).toHaveBeenCalledWith({
      authToken: 'token-123',
      nickname: 'Pixel Hero',
    });
    expect(store.getState().profile.tag).toBe('SRV');
  });

  it('keeps the overlay open on remote rejection by returning an async error', async () => {
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => ({
        profile: { nickname: 'LimeComet', tag: 'SRV' },
        authToken: 'token-123',
      }),
      renameProfile: async () => {
        throw new Error('server_rejected');
      },
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      submitRun: async () => null,
    };

    const store = createProfileStore({ initialSeed: 7, client, autoBootstrap: false });
    await store.getState().bootstrapRemote();
    const result = await store.getState().rename('Pixel Hero');

    expect(result).toEqual({ ok: false, error: 'server_rejected' });
    expect(store.getState().profile.nickname).toBe('LimeComet');
  });
});
