import { create } from 'zustand';

import { KEYS, getJSON, setJSON, setJSONOrThrow } from '@/core/storage';
import { createLeaderboardClient, type LeaderboardClient } from '@/features/leaderboard/client';
import type { AdventureSeasonWindow } from '@/features/leaderboard/types';
import { useMascot } from '@/features/mascot/store';

import { seasonRewardCosmetic } from './logic/config';
import { seasonLength } from './logic/seasons';
import { adventureSeasonWindowNeedsRefresh } from './logic/seasonWindow';

export interface AdventureDaily {
  date: string;
  cleared: number;
}

interface AdventurePersist {
  v: 2;
  /** Personal progression; the calendar setting lives in seasonWindow. */
  seasonId: number;
  levelIndex: number;
  consecutive: number;
  daily: AdventureDaily;
  trophies: number[];
  seasonWindow: AdventureSeasonWindow | null;
  seasonWindowSyncedAtMs: number | null;
  seasonWindowRetryAtMs: number | null;
  seasonWindowFailureCount: number;
  settledRunIds: string[];
  settledCompletionIds: string[];
}

interface AdventureState extends AdventurePersist {
  lastWinCompletedSeason: number | null;
  syncStatus: 'idle' | 'syncing' | 'ready' | 'error';
  seasonLen: () => number;
  dailyCleared: (date: string) => number;
  applySeasonWindow: (window: AdventureSeasonWindow) => void;
  syncSeasonWindow: (
    authToken: string,
    options?: { nowMs?: number; force?: boolean },
  ) => Promise<AdventureSeasonWindow | null>;
  recordWin: (date: string) => void;
  recordFail: () => void;
  recordWinOnce: (completionId: string, runId: string, date: string) => boolean;
  recordFailOnce: (runId: string) => boolean;
  ackSeasonCelebration: () => void;
  hydrate: () => void;
  reset: () => void;
}

const EMPTY_DAILY: AdventureDaily = { date: '', cleared: 0 };
const client: LeaderboardClient = createLeaderboardClient();

function initialState(): AdventurePersist {
  const saved = getJSON<Omit<Partial<AdventurePersist>, 'v'> & { v?: 1 | 2 }>(KEYS.adventure);
  if ((saved?.v === 1 || saved?.v === 2) && Number.isInteger(saved.seasonId) && Number.isInteger(saved.levelIndex)) {
    return {
      v: 2,
      seasonId: Math.max(1, saved.seasonId ?? 1),
      levelIndex: Math.max(0, saved.levelIndex ?? 0),
      consecutive: Math.max(0, saved.consecutive ?? 0),
      daily: saved.daily?.date ? saved.daily : EMPTY_DAILY,
      trophies: Array.isArray(saved.trophies) ? saved.trophies : [],
      seasonWindow: normalizeSeasonWindow(saved.seasonWindow),
      seasonWindowSyncedAtMs:
        typeof saved.seasonWindowSyncedAtMs === 'number' ? saved.seasonWindowSyncedAtMs : null,
      seasonWindowRetryAtMs:
        typeof saved.seasonWindowRetryAtMs === 'number' ? saved.seasonWindowRetryAtMs : null,
      seasonWindowFailureCount: Math.max(0, saved.seasonWindowFailureCount ?? 0),
      settledRunIds: Array.isArray(saved.settledRunIds) ? saved.settledRunIds : [],
      settledCompletionIds:
        saved.v === 2 && Array.isArray(saved.settledCompletionIds)
          ? saved.settledCompletionIds
          : [],
    };
  }
  return {
    v: 2,
    seasonId: 1,
    levelIndex: 0,
    consecutive: 0,
    daily: EMPTY_DAILY,
    trophies: [],
    seasonWindow: null,
    seasonWindowSyncedAtMs: null,
    seasonWindowRetryAtMs: null,
    seasonWindowFailureCount: 0,
    settledRunIds: [],
    settledCompletionIds: [],
  };
}

function persist(state: AdventurePersist, critical = false): void {
  const value = {
    v: 2,
    seasonId: state.seasonId,
    levelIndex: state.levelIndex,
    consecutive: state.consecutive,
    daily: state.daily,
    trophies: state.trophies,
    seasonWindow: state.seasonWindow,
    seasonWindowSyncedAtMs: state.seasonWindowSyncedAtMs,
    seasonWindowRetryAtMs: state.seasonWindowRetryAtMs,
    seasonWindowFailureCount: state.seasonWindowFailureCount,
    settledRunIds: state.settledRunIds,
    settledCompletionIds: state.settledCompletionIds,
  };
  if (critical) setJSONOrThrow(KEYS.adventure, value);
  else setJSON(KEYS.adventure, value);
}

function normalizeSeasonWindow(value: unknown): AdventureSeasonWindow | null {
  const window = value as Partial<AdventureSeasonWindow> | null;
  const seasonId = window?.seasonId;
  const durationDays = window?.durationDays;
  if (
    !window ||
    typeof seasonId !== 'number' ||
    !Number.isInteger(seasonId) ||
    typeof window.serverNowIso !== 'string' ||
    typeof window.windowStartIso !== 'string' ||
    typeof window.windowEndIso !== 'string' ||
    typeof durationDays !== 'number' ||
    !Number.isInteger(durationDays)
  ) {
    return null;
  }
  return {
    seasonId: Math.max(1, seasonId),
    serverNowIso: window.serverNowIso,
    windowStartIso: window.windowStartIso,
    windowEndIso: window.windowEndIso,
    durationDays,
  };
}

function reconcileSeasonCosmetics(trophies: readonly number[]): void {
  for (const seasonId of trophies) {
    const cosmeticId = seasonRewardCosmetic(seasonId);
    if (cosmeticId) useMascot.getState().unlock(cosmeticId);
  }
}

const SEASON_WINDOW_RETRY_DELAYS_MS = [
  30_000,
  2 * 60_000,
  10 * 60_000,
  30 * 60_000,
] as const;

function nextSeasonWindowRetryAt(nowMs: number, failureIndex: number): number {
  return nowMs + SEASON_WINDOW_RETRY_DELAYS_MS[
    Math.min(failureIndex, SEASON_WINDOW_RETRY_DELAYS_MS.length - 1)
  ];
}

export const useAdventure = create<AdventureState>((set, get) => ({
  ...initialState(),
  lastWinCompletedSeason: null,
  syncStatus: 'idle',

  seasonLen: () => seasonLength(get().seasonId),

  dailyCleared: (date) => {
    const daily = get().daily;
    return daily.date === date ? daily.cleared : 0;
  },

  applySeasonWindow: (window) => {
    set({
      seasonWindow: window,
      seasonWindowSyncedAtMs: Date.now(),
      seasonWindowRetryAtMs: null,
      seasonWindowFailureCount: 0,
      syncStatus: 'ready',
    });
    persist(get());
  },

  syncSeasonWindow: async (authToken, options = {}) => {
    const nowMs = options.nowMs ?? Date.now();
    const current = get();
    if (
      !options.force &&
      !adventureSeasonWindowNeedsRefresh(
        current.seasonWindow,
        current.seasonWindowSyncedAtMs,
        nowMs,
      )
    ) return current.seasonWindow;
    if (
      !options.force &&
      current.seasonWindowRetryAtMs !== null &&
      nowMs < current.seasonWindowRetryAtMs
    ) return null;
    if (get().syncStatus === 'syncing') return null;
    set({ syncStatus: 'syncing' });
    try {
      if (client.kind === 'local' || !client.getAdventureSeason) {
        throw new Error('season_window_offline');
      }
      const window = await client.getAdventureSeason({ authToken });
      if (!window) throw new Error('season_window_empty');
      set({
        seasonWindow: window,
        seasonWindowSyncedAtMs: nowMs,
        seasonWindowRetryAtMs: null,
        seasonWindowFailureCount: 0,
        syncStatus: 'ready',
      });
      persist(get());
      return window;
    } catch {
      const failureCount = Math.min(4, current.seasonWindowFailureCount + 1);
      set({
        syncStatus: 'error',
        seasonWindowFailureCount: failureCount,
        seasonWindowRetryAtMs: nextSeasonWindowRetryAt(nowMs, failureCount - 1),
      });
      persist(get());
      return null;
    }
  },

  recordWin: (date) => {
    const current = get();
    const len = seasonLength(current.seasonId);
    const completedSeason = current.levelIndex + 1 >= len;
    const nextSeasonId = completedSeason ? current.seasonId + 1 : current.seasonId;
    const nextLevelIndex = completedSeason ? 0 : current.levelIndex + 1;
    const daily =
      current.daily.date === date
        ? { date, cleared: current.daily.cleared + 1 }
        : { date, cleared: 1 };
    const next = {
      v: 2 as const,
      seasonId: nextSeasonId,
      levelIndex: nextLevelIndex,
      consecutive: current.consecutive + 1,
      daily,
      seasonWindow: current.seasonWindow,
      seasonWindowSyncedAtMs: current.seasonWindowSyncedAtMs,
      seasonWindowRetryAtMs: current.seasonWindowRetryAtMs,
      seasonWindowFailureCount: current.seasonWindowFailureCount,
      trophies: completedSeason
        ? [...new Set([...current.trophies, current.seasonId])]
        : current.trophies,
      settledRunIds: current.settledRunIds,
      settledCompletionIds: current.settledCompletionIds,
    };
    set({ ...next, lastWinCompletedSeason: completedSeason ? current.seasonId : null });
    persist(next);
  },

  recordFail: () => {
    const current = get();
    const next = {
      v: 2 as const,
      seasonId: current.seasonId,
      levelIndex: current.levelIndex,
      consecutive: 0,
      daily: current.daily,
      trophies: current.trophies,
      seasonWindow: current.seasonWindow,
      seasonWindowSyncedAtMs: current.seasonWindowSyncedAtMs,
      seasonWindowRetryAtMs: current.seasonWindowRetryAtMs,
      seasonWindowFailureCount: current.seasonWindowFailureCount,
      settledRunIds: current.settledRunIds,
      settledCompletionIds: current.settledCompletionIds,
    };
    set({ ...next, lastWinCompletedSeason: null });
    persist(next);
  },

  recordWinOnce: (completionId, runId, date) => {
    if (
      get().settledCompletionIds.includes(completionId) ||
      get().settledRunIds.includes(runId)
    ) return false;
    const current = get();
    const len = seasonLength(current.seasonId);
    const completedSeason = current.levelIndex + 1 >= len;
    const next = {
      v: 2 as const,
      seasonId: completedSeason ? current.seasonId + 1 : current.seasonId,
      levelIndex: completedSeason ? 0 : current.levelIndex + 1,
      consecutive: current.consecutive + 1,
      daily:
        current.daily.date === date
          ? { date, cleared: current.daily.cleared + 1 }
          : { date, cleared: 1 },
      trophies: completedSeason
        ? [...new Set([...current.trophies, current.seasonId])]
        : current.trophies,
      seasonWindow: current.seasonWindow,
      seasonWindowSyncedAtMs: current.seasonWindowSyncedAtMs,
      seasonWindowRetryAtMs: current.seasonWindowRetryAtMs,
      seasonWindowFailureCount: current.seasonWindowFailureCount,
      settledRunIds: [...current.settledRunIds, runId],
      settledCompletionIds: [...current.settledCompletionIds, completionId],
    };
    persist(next, true);
    set({ ...next, lastWinCompletedSeason: completedSeason ? current.seasonId : null });
    return true;
  },

  recordFailOnce: (runId) => {
    if (get().settledRunIds.includes(runId)) return false;
    const current = get();
    const next = {
      v: 2 as const,
      seasonId: current.seasonId,
      levelIndex: current.levelIndex,
      consecutive: 0,
      daily: current.daily,
      trophies: current.trophies,
      seasonWindow: current.seasonWindow,
      seasonWindowSyncedAtMs: current.seasonWindowSyncedAtMs,
      seasonWindowRetryAtMs: current.seasonWindowRetryAtMs,
      seasonWindowFailureCount: current.seasonWindowFailureCount,
      settledRunIds: [...current.settledRunIds, runId],
      settledCompletionIds: current.settledCompletionIds,
    };
    persist(next, true);
    set({ ...next, lastWinCompletedSeason: null });
    return true;
  },

  ackSeasonCelebration: () => set({ lastWinCompletedSeason: null }),

  hydrate: () => {
    const hydrated = initialState();
    set({ ...hydrated, lastWinCompletedSeason: null, syncStatus: 'idle' });
    reconcileSeasonCosmetics(hydrated.trophies);
  },

  reset: () => {
    const next = {
      v: 2 as const,
      seasonId: 1,
      levelIndex: 0,
      consecutive: 0,
      daily: EMPTY_DAILY,
      trophies: [],
      seasonWindow: null,
      seasonWindowSyncedAtMs: null,
      seasonWindowRetryAtMs: null,
      seasonWindowFailureCount: 0,
      settledRunIds: [],
      settledCompletionIds: [],
    };
    set({ ...next, lastWinCompletedSeason: null, syncStatus: 'idle' });
    persist(next);
  },
}));

// Trophies are the durable entitlement source. Reconcile on every cold module
// load so a torn mascot write can never permanently lose a season cosmetic.
reconcileSeasonCosmetics(useAdventure.getState().trophies);
