import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'blockblast' });

/** Все ключи персиста — в одном месте (спека 02). */
export const KEYS = {
  gameCurrent: 'game.current',
  classicRunMeta: 'game.classic.meta.v1',
  classicRunEnvelope: 'game.classic.envelope.v1',
  classicRunArchive: 'game.classic.archive.v1',
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
  leaderboardWeeklyOutcomes: 'leaderboard.weekly-outcomes.v1',
  leaderboardGoals: 'leaderboard.goals.v1',
  analyticsQueue: 'analytics.queue',
  analyticsPrefs: 'analytics.prefs',
  analyticsSessionMeta: 'analytics.session.meta',
  analyticsRuntime: 'analytics.runtime.v2',
  analyticsExperiments: 'analytics.experiments.v1',
  analyticsNextGoal: 'analytics.next-goal.v1',
  analyticsNotificationAttribution: 'analytics.notification-attribution.v1',
  entitlements: 'iap.entitlements',
  adsMeta: 'ads.meta',
  adsPresentation: 'ads.presentation.v1',
  adventureXpBonus: 'ads.adventure-xp-bonus.v1',
  tutorialDone: 'tutorial.done',
  mascot: 'mascot.state',
  progression: 'progression.state',
  daily: 'daily.state',
  adventure: 'adventure.state',
  adventureRun: 'adventure.run',
  adventureRunArchive: 'adventure.run.archive.v1',
  adventureMapScroll: 'adventure.map-scroll.v1',
  onboardingMeta: 'onboarding.meta.v1',
  onboardingWelcomePrompt: 'onboarding.welcome-prompt.v1',
  pushPrompt: 'push.prompt.v1',
  homeSelectedMode: 'home.selected-mode.v1',
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

/** Commit-critical write. Unlike the SSR-safe helpers, failures stay visible. */
export function setJSONOrThrow(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
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

/** Commit-critical string write used by crash-recovery checkpoints. */
export function setStringOrThrow(key: string, value: string): void {
  storage.set(key, value);
}

export function removeKey(key: string): void {
  try {
    storage.remove(key);
  } catch {
    // Browser storage is unavailable during Expo server rendering.
  }
}
