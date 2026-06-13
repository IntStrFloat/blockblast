import { create } from 'zustand';

import { KEYS, getJSON, getString, removeKey, setJSON, setString } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics/store';
import { createLeaderboardClient, type BackendProfileSession, type LeaderboardClient } from '@/features/leaderboard/client';

import {
  createGeneratedProfile,
  type GeneratedProfile,
  type NicknameValidationError,
  normalizeNickname,
  validateNickname,
} from './nickname';

type ProfileError = NicknameValidationError | 'remote_unavailable' | 'server_rejected';
type RenameResult = { ok: true } | { ok: false; error: ProfileError };

export interface ProfileState {
  profile: GeneratedProfile;
  authToken: string | null;
  syncStatus: 'idle' | 'syncing' | 'ready' | 'error';
  lastError: ProfileError | null;
  reroll: () => void;
  rename: (input: string) => Promise<RenameResult>;
  bootstrapRemote: () => Promise<BackendProfileSession | null>;
  resetForTests: (profile?: GeneratedProfile) => void;
}

interface CreateProfileStoreOptions {
  initialSeed?: number;
  client?: LeaderboardClient;
  autoBootstrap?: boolean;
}

function persistProfile(profile: GeneratedProfile, authToken: string | null): void {
  setJSON(KEYS.profileLocal, profile);
  if (authToken) {
    setString(KEYS.profileAuth, authToken);
  } else {
    removeKey(KEYS.profileAuth);
  }
}

function applyRemoteProfile(local: GeneratedProfile, remote: { nickname: string; tag: string }) {
  const nickname = normalizeNickname(remote.nickname || local.nickname);
  return {
    ...local,
    nickname,
    normalizedNickname: nickname.toLowerCase(),
    tag: remote.tag || local.tag,
  };
}

function mapRemoteError(error: unknown): ProfileError {
  const message = error instanceof Error ? error.message : '';
  if (/request_failed:4/.test(message) || /server_rejected/.test(message)) {
    return 'server_rejected';
  }
  return 'remote_unavailable';
}

export function createProfileStore(options: CreateProfileStoreOptions = {}) {
  const initialSeed = options.initialSeed ?? Math.floor(Date.now() % 46646);
  const client = options.client ?? createLeaderboardClient();
  const storedAuth = getString(KEYS.profileAuth);
  const storedProfile = getJSON<GeneratedProfile>(KEYS.profileLocal);
  const initialProfile = storedProfile ?? createGeneratedProfile(initialSeed);
  persistProfile(initialProfile, storedAuth);

  const store = create<ProfileState>((set, get) => ({
    profile: initialProfile,
    authToken: storedAuth,
    syncStatus: storedAuth ? 'ready' : 'idle',
    lastError: null,

    reroll: () => {
      const current = get().profile;
      const nextProfile = {
        ...createGeneratedProfile(current.seed + 1),
        tag: current.tag,
      };
      persistProfile(nextProfile, get().authToken);
      set({ profile: nextProfile, lastError: null });
      useAnalyticsStore.getState().track('nickname_rerolled', { source: 'profile_overlay' });
    },

    rename: async (input) => {
      const result = validateNickname(input);
      if (!result.ok) {
        set({ lastError: result.error });
        return { ok: false, error: result.error };
      }

      useAnalyticsStore.getState().track('nickname_change_submitted', { source: 'profile_overlay' });

      if (client.kind === 'local') {
        const nextProfile = {
          ...get().profile,
          nickname: result.nickname,
          normalizedNickname: result.normalizedNickname,
        };
        persistProfile(nextProfile, get().authToken);
        set({ profile: nextProfile, syncStatus: 'idle', lastError: null });
        useAnalyticsStore.getState().track('nickname_change_result', { success: true });
        return { ok: true };
      }

      const authToken = get().authToken ?? (await store.getState().bootstrapRemote())?.authToken ?? null;
      if (!authToken) {
        const nextProfile = {
          ...get().profile,
          nickname: result.nickname,
          normalizedNickname: result.normalizedNickname,
        };
        persistProfile(nextProfile, null);
        set({ profile: nextProfile, syncStatus: 'error', lastError: 'remote_unavailable' });
        useAnalyticsStore.getState().track('nickname_change_result', { success: true });
        return { ok: true };
      }

      set({ syncStatus: 'syncing', lastError: null });
      try {
        const remote = await client.renameProfile({
          authToken,
          nickname: result.nickname,
        });
        const nextProfile = applyRemoteProfile(
          {
            ...get().profile,
            nickname: result.nickname,
            normalizedNickname: result.normalizedNickname,
          },
          remote,
        );
        persistProfile(nextProfile, authToken);
        set({ profile: nextProfile, authToken, syncStatus: 'ready', lastError: null });
        useAnalyticsStore.getState().track('nickname_change_result', { success: true });
        return { ok: true };
      } catch (error) {
        const mappedError = mapRemoteError(error);
        if (mappedError === 'remote_unavailable') {
          const nextProfile = {
            ...get().profile,
            nickname: result.nickname,
            normalizedNickname: result.normalizedNickname,
          };
          persistProfile(nextProfile, authToken);
          set({ profile: nextProfile, authToken, syncStatus: 'error', lastError: mappedError });
          useAnalyticsStore.getState().track('nickname_change_result', { success: true });
          return { ok: true };
        }
        set({ syncStatus: 'error', lastError: mappedError });
        useAnalyticsStore.getState().track('nickname_change_result', { success: false });
        return { ok: false, error: mappedError };
      }
    },

    bootstrapRemote: async () => {
      if (client.kind === 'local') return null;
      set({ syncStatus: 'syncing', lastError: null });
      try {
        const session = await client.bootstrapProfile({
          nickname: get().profile.nickname,
          authToken: get().authToken,
        });
        if (!session) {
          set({ syncStatus: 'idle', lastError: null });
          return null;
        }
        const profile = applyRemoteProfile(get().profile, session.profile);
        persistProfile(profile, session.authToken);
        set({
          profile,
          authToken: session.authToken,
          syncStatus: 'ready',
          lastError: null,
        });
        return session;
      } catch {
        set({ syncStatus: 'error', lastError: 'remote_unavailable' });
        return null;
      }
    },

    resetForTests: (profile = createGeneratedProfile(7)) => {
      persistProfile(profile, null);
      set({
        profile,
        authToken: null,
        syncStatus: 'idle',
        lastError: null,
      });
    },
  }));

  if (!storedProfile) {
    useAnalyticsStore.getState().track('profile_created', { source: 'generated' });
  }

  if (options.autoBootstrap !== false) {
    void store.getState().bootstrapRemote();
  }

  return store;
}

export const useProfileStore = createProfileStore();
