import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';
import { createLeaderboardClient, type LeaderboardClient } from '@/features/leaderboard/client';
import type { AdventureSeasonWindow } from '@/features/leaderboard/types';

import { seasonLength } from './logic/seasons';

export interface AdventureDaily {
  date: string;
  cleared: number;
}

interface AdventurePersist {
  v: 1;
  seasonId: number;
  levelIndex: number;
  consecutive: number;
  daily: AdventureDaily;
  trophies: number[];
  seasonWindow: AdventureSeasonWindow | null;
  seasonWindowSyncedAtMs: number | null;
}

interface AdventureState extends AdventurePersist {
  lastWinCompletedSeason: number | null;
  syncStatus: 'idle' | 'syncing' | 'ready' | 'error';
  seasonLen: () => number;
  dailyCleared: (date: string) => number;
  applySeasonWindow: (window: AdventureSeasonWindow) => void;
  syncSeasonWindow: (authToken: string) => Promise<AdventureSeasonWindow | null>;
  recordWin: (date: string) => void;
  recordFail: () => void;
  ackSeasonCelebration: () => void;
  hydrate: () => void;
  reset: () => void;
}

const EMPTY_DAILY: AdventureDaily = { date: '', cleared: 0 };
const client: LeaderboardClient = createLeaderboardClient();

function initialState(): AdventurePersist {
  const saved = getJSON<AdventurePersist>(KEYS.adventure);
  if (saved?.v === 1 && Number.isInteger(saved.seasonId) && Number.isInteger(saved.levelIndex)) {
    return {
      v: 1,
      seasonId: Math.max(1, saved.seasonId),
      levelIndex: Math.max(0, saved.levelIndex),
      consecutive: Math.max(0, saved.consecutive ?? 0),
      daily: saved.daily?.date ? saved.daily : EMPTY_DAILY,
      trophies: Array.isArray(saved.trophies) ? saved.trophies : [],
      seasonWindow: normalizeSeasonWindow(saved.seasonWindow),
      seasonWindowSyncedAtMs:
        typeof saved.seasonWindowSyncedAtMs === 'number' ? saved.seasonWindowSyncedAtMs : null,
    };
  }
  return {
    v: 1,
    seasonId: 1,
    levelIndex: 0,
    consecutive: 0,
    daily: EMPTY_DAILY,
    trophies: [],
    seasonWindow: null,
    seasonWindowSyncedAtMs: null,
  };
}

function persist(state: AdventurePersist): void {
  setJSON(KEYS.adventure, {
    v: 1,
    seasonId: state.seasonId,
    levelIndex: state.levelIndex,
    consecutive: state.consecutive,
    daily: state.daily,
    trophies: state.trophies,
    seasonWindow: state.seasonWindow,
    seasonWindowSyncedAtMs: state.seasonWindowSyncedAtMs,
  });
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
    const current = get();
    const seasonChanged = window.seasonId !== current.seasonId;
    const next = {
      v: 1 as const,
      seasonId: window.seasonId,
      levelIndex: seasonChanged ? 0 : current.levelIndex,
      consecutive: seasonChanged ? 0 : current.consecutive,
      daily: current.daily,
      trophies: current.trophies,
      seasonWindow: window,
      seasonWindowSyncedAtMs: Date.now(),
    };
    set({ ...next, lastWinCompletedSeason: null, syncStatus: 'ready' });
    persist(next);
  },

  syncSeasonWindow: async (authToken) => {
    if (client.kind === 'local' || !client.getAdventureSeason) return null;
    if (get().syncStatus === 'syncing') return null;
    set({ syncStatus: 'syncing' });
    try {
      const window = await client.getAdventureSeason({ authToken });
      if (!window) {
        set({ syncStatus: 'idle' });
        return null;
      }
      get().applySeasonWindow(window);
      return window;
    } catch {
      set({ syncStatus: 'error' });
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
      v: 1 as const,
      seasonId: nextSeasonId,
      levelIndex: nextLevelIndex,
      consecutive: current.consecutive + 1,
      daily,
      seasonWindow: current.seasonWindow,
      seasonWindowSyncedAtMs: current.seasonWindowSyncedAtMs,
      trophies: completedSeason
        ? [...new Set([...current.trophies, current.seasonId])]
        : current.trophies,
    };
    set({ ...next, lastWinCompletedSeason: completedSeason ? current.seasonId : null });
    persist(next);
  },

  recordFail: () => {
    const current = get();
    const next = {
      v: 1 as const,
      seasonId: current.seasonId,
      levelIndex: current.levelIndex,
      consecutive: 0,
      daily: current.daily,
      trophies: current.trophies,
      seasonWindow: current.seasonWindow,
      seasonWindowSyncedAtMs: current.seasonWindowSyncedAtMs,
    };
    set({ ...next, lastWinCompletedSeason: null });
    persist(next);
  },

  ackSeasonCelebration: () => set({ lastWinCompletedSeason: null }),

  hydrate: () => set({ ...initialState(), lastWinCompletedSeason: null, syncStatus: 'idle' }),

  reset: () => {
    const next = {
      v: 1 as const,
      seasonId: 1,
      levelIndex: 0,
      consecutive: 0,
      daily: EMPTY_DAILY,
      trophies: [],
      seasonWindow: null,
      seasonWindowSyncedAtMs: null,
    };
    set({ ...next, lastWinCompletedSeason: null, syncStatus: 'idle' });
    persist(next);
  },
}));
