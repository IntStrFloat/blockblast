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
  leaderboardPrizes: 'leaderboard.prizes',
  analyticsQueue: 'analytics.queue',
  analyticsPrefs: 'analytics.prefs',
  entitlements: 'iap.entitlements',
  adsMeta: 'ads.meta',
  tutorialDone: 'tutorial.done',
  mascot: 'mascot.state',
  progression: 'progression.state',
  daily: 'daily.state',
  onboardingMeta: 'onboarding.meta.v1',
  pushPrompt: 'push.prompt.v1',
} as const;

export function getJSON<T>(key: string): T | null {
  const raw = getString(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJSON(key: string, value: unknown): void {
  setString(key, JSON.stringify(value));
}

export function getString(key: string): string | null {
  try {
    return storage.getString(key) ?? null;
  } catch {
    return null;
  }
}

export function setString(key: string, value: string): void {
  try {
    storage.set(key, value);
  } catch {
    // Browser storage is unavailable during Expo server rendering.
  }
}

export function removeKey(key: string): void {
  try {
    storage.remove(key);
  } catch {
    // Browser storage is unavailable during Expo server rendering.
  }
}
