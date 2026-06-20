import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

import { PROGRESSION_CONFIG } from './logic/config';
import { progressFor } from './logic/levels';
import { worldStartLevels } from './logic/worlds';
import { rewardsBetween } from './logic/rewards';
import type { LevelReward } from './logic/types';

export interface ProgressionState {
  lifetimePoints: number;
  level: number;
  world: number;
  unlockedThemes: string[];
  activeTheme: string;
  claimedRewards: string[];
}

export interface AddPointsResult {
  fromLevel: number;
  toLevel: number;
  rewards: LevelReward[];
  enteredWorld: number | null;
}

interface ProgressionActions {
  addPoints: (amount: number) => AddPointsResult;
  setActiveTheme: (id: string) => void;
  pointsInLevel: () => number;
  pointsToNext: () => number;
  nextWorldAt: () => number | null;
}

type ProgressionStore = ProgressionState & ProgressionActions;

function themesThroughWorld(world: number): string[] {
  const ids: string[] = [];
  for (let w = 1; w <= world; w++) {
    const id = PROGRESSION_CONFIG.worldThemeId[w];
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Чистая логика выбора стартовых очков: сохранённый прогресс приоритетнее;
 * иначе миграция со старой XP Капи (она фактически = накопленный счёт); иначе 0.
 */
export function resolveLifetimePoints(
  savedProgression: { lifetimePoints?: number } | null,
  savedMascot: { totalXp?: number } | null,
): number {
  if (savedProgression && typeof savedProgression.lifetimePoints === 'number') {
    return Math.max(0, savedProgression.lifetimePoints);
  }
  if (savedMascot && typeof savedMascot.totalXp === 'number') {
    return Math.max(0, savedMascot.totalXp);
  }
  return 0;
}

function buildInitial(): ProgressionState {
  const saved = getJSON<Partial<ProgressionState>>(KEYS.progression);
  const savedMascot = getJSON<{ totalXp?: number }>(KEYS.mascot);
  const lifetimePoints = resolveLifetimePoints(saved, savedMascot);
  const info = progressFor(lifetimePoints);
  const unlockedThemes = themesThroughWorld(info.world);
  const fallbackTheme = unlockedThemes[unlockedThemes.length - 1] ?? 'classic';
  const defaultTheme = PROGRESSION_CONFIG.worldThemeId[info.world] ?? fallbackTheme;
  const savedActive = saved?.activeTheme;
  const activeTheme =
    savedActive && unlockedThemes.includes(savedActive) ? savedActive : defaultTheme;
  return {
    lifetimePoints,
    level: info.level,
    world: info.world,
    unlockedThemes,
    activeTheme,
    claimedRewards: saved?.claimedRewards ?? [],
  };
}

function persist(state: ProgressionState): void {
  setJSON(KEYS.progression, {
    lifetimePoints: state.lifetimePoints,
    level: state.level,
    world: state.world,
    unlockedThemes: state.unlockedThemes,
    activeTheme: state.activeTheme,
    claimedRewards: state.claimedRewards,
  });
}

export const useProgression = create<ProgressionStore>((set, get) => ({
  ...buildInitial(),

  addPoints(amount) {
    const prev = get();
    const add = Math.max(0, Math.floor(amount));
    const fromLevel = prev.level;
    const lifetimePoints = prev.lifetimePoints + add;
    const info = progressFor(lifetimePoints);
    const toLevel = info.level;
    const rewards = rewardsBetween(fromLevel, toLevel);
    const unlockedThemes = themesThroughWorld(info.world);
    const enteredWorld = info.world > prev.world ? info.world : null;

    let activeTheme = prev.activeTheme;
    if (enteredWorld !== null) {
      const themeId = PROGRESSION_CONFIG.worldThemeId[enteredWorld];
      if (themeId !== undefined) activeTheme = themeId;
    }

    const claimedRewards = [...prev.claimedRewards];
    for (const r of rewards) {
      if (r.kind === 'cosmetic' && !claimedRewards.includes(r.id)) claimedRewards.push(r.id);
    }

    const next: ProgressionState = {
      lifetimePoints,
      level: toLevel,
      world: info.world,
      unlockedThemes,
      activeTheme,
      claimedRewards,
    };
    set(next);
    persist(next);
    return { fromLevel, toLevel, rewards, enteredWorld };
  },

  setActiveTheme(id) {
    const prev = get();
    if (!prev.unlockedThemes.includes(id)) return;
    const next: ProgressionState = { ...prev, activeTheme: id };
    set({ activeTheme: id });
    persist(next);
  },

  pointsInLevel() {
    return progressFor(get().lifetimePoints).pointsInLevel;
  },
  pointsToNext() {
    return progressFor(get().lifetimePoints).pointsToNext;
  },
  nextWorldAt() {
    const { level } = get();
    for (const s of worldStartLevels()) {
      if (s > level) return s;
    }
    return null;
  },
}));
