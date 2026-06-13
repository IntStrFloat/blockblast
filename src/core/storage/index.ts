import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'blockblast' });

/** Все ключи персиста — в одном месте (спека 02). */
export const KEYS = {
  gameCurrent: 'game.current',
  scoresBest: 'scores.best',
  scoresStats: 'scores.stats',
  streak: 'streak.state',
  settings: 'settings.v1',
  profileLocal: 'profile.local',
  profileAuth: 'profile.auth',
  leaderboardActiveProof: 'leaderboard.activeProof',
  leaderboardRuns: 'leaderboard.runs',
  leaderboardSnapshot: 'leaderboard.snapshot',
  leaderboardDaily: 'leaderboard.daily',
  leaderboardPending: 'leaderboard.pending',
  leaderboardTickets: 'leaderboard.tickets',
  analyticsQueue: 'analytics.queue',
  analyticsPrefs: 'analytics.prefs',
  entitlements: 'iap.entitlements',
  adsMeta: 'ads.meta',
  tutorialDone: 'tutorial.done',
} as const;

export function getJSON<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

export function getString(key: string): string | null {
  return storage.getString(key) ?? null;
}

export function setString(key: string, value: string): void {
  storage.set(key, value);
}

export function removeKey(key: string): void {
  storage.remove(key);
}
