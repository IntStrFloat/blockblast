import { create } from 'zustand';

import { KEYS, getJSON, setJSON, setJSONOrThrow } from '@/core/storage';
import { recordNextGoalCompletion, useAnalyticsStore } from '@/features/analytics';

import { PROGRESSION_CONFIG } from './logic/config';
import { progressFor } from './logic/levels';
import { worldStartLevels } from './logic/worlds';
import { levelForReward, rewardsBetween } from './logic/rewards';
import type { LevelReward } from './logic/types';

export interface ProgressionState {
  lifetimePoints: number;
  level: number;
  world: number;
  unlockedThemes: string[];
  activeTheme: string;
  claimedRewards: string[];
  appliedSettlements: string[];
  rewardReceipts: Record<string, RewardReceipt>;
}

export type RewardSource = 'classic' | 'adventure' | 'weekly';

export interface RewardReceipt {
  runId: string;
  /** Stable entitlement identity; unlike runId it survives retries/new attempts. */
  completionId: string;
  rewardId: string;
  source: RewardSource;
  grantedAmount: number;
  lifetimePointsBefore: number;
  lifetimePointsAfter: number;
  fromLevel: number;
  toLevel: number;
  updatedAt: number;
}

export interface GrantRewardInput {
  runId: string;
  /** Defaults to runId for Classic/backwards-compatible callers. */
  completionId?: string;
  rewardId: string;
  source: RewardSource;
  /** Cumulative entitlement for this run/reward, not an increment. */
  targetAmount: number;
}

export function rewardReceiptKey(completionId: string, rewardId: string): string {
  return `${completionId}::${rewardId}`;
}

export interface AddPointsResult {
  fromLevel: number;
  toLevel: number;
  rewards: LevelReward[];
  enteredWorld: number | null;
}

/** Transient полезная нагрузка level-up reveal (не персистится). Владелец — координатор (спека 15 §4). */
export interface ProgressionReveal {
  id: string;
  runId: string;
  level: number;
  rewards: LevelReward[];
}

interface ProgressionActions {
  addPoints: (amount: number) => AddPointsResult;
  addPointsOnce: (settlementId: string, amount: number) => AddPointsResult & { applied: boolean };
  grantReward: (
    input: GrantRewardInput,
  ) => AddPointsResult & { applied: boolean; grantedDelta: number; receipt: RewardReceipt };
  setActiveTheme: (id: string) => void;
  pointsInLevel: () => number;
  pointsToNext: () => number;
  nextWorldAt: () => number | null;
  enqueueReveal: (reveal: ProgressionReveal) => void;
  presentRevealForRun: (runId: string) => void;
  clearReveal: () => void;
  discardRevealsForRun: (runId?: string) => void;
}

type ProgressionStore = ProgressionState & ProgressionActions & {
  reveal: ProgressionReveal | null;
  revealQueue: ProgressionReveal[];
};

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
    appliedSettlements: saved?.appliedSettlements ?? [],
    rewardReceipts: saved?.rewardReceipts ?? {},
  };
}

function persistedProgression(state: ProgressionState) {
  return {
    lifetimePoints: state.lifetimePoints,
    level: state.level,
    world: state.world,
    unlockedThemes: state.unlockedThemes,
    activeTheme: state.activeTheme,
    claimedRewards: state.claimedRewards,
    appliedSettlements: state.appliedSettlements,
    rewardReceipts: state.rewardReceipts,
  };
}

function persist(state: ProgressionState, critical = false): void {
  const value = persistedProgression(state);
  if (critical) setJSONOrThrow(KEYS.progression, value);
  else setJSON(KEYS.progression, value);
}

export const useProgression = create<ProgressionStore>((set, get) => ({
  ...buildInitial(),
  reveal: null,
  revealQueue: [],

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
      appliedSettlements: prev.appliedSettlements,
      rewardReceipts: prev.rewardReceipts,
    };
    set(next);
    persist(next);
    // События для когортного анализа (retention фаза 2): рост уровня и вход в мир.
    if (toLevel > fromLevel) {
      useAnalyticsStore.getState().track('level_up', { level: toLevel, world: info.world });
    }
    if (enteredWorld !== null) {
      useAnalyticsStore.getState().track('world_unlocked', { world: enteredWorld });
    }
    return { fromLevel, toLevel, rewards, enteredWorld };
  },

  addPointsOnce(settlementId, amount) {
    const result = get().grantReward({
      runId: settlementId,
      rewardId: 'legacy-points',
      source: 'classic',
      targetAmount: amount,
    });
    return result;
  },

  grantReward(input) {
    const current = get();
    const completionId = input.completionId ?? input.runId;
    const receiptKey = rewardReceiptKey(completionId, input.rewardId);
    const previousReceipt = current.rewardReceipts[receiptKey];
    const targetAmount = Math.max(0, Math.floor(input.targetAmount));
    const legacyLocked =
      !previousReceipt &&
      (current.appliedSettlements.includes(completionId) ||
        current.appliedSettlements.includes(input.runId) ||
        current.appliedSettlements.includes(`${input.source}:${input.runId}`));
    const previousAmount = legacyLocked ? targetAmount : (previousReceipt?.grantedAmount ?? 0);
    const add = Math.max(0, targetAmount - previousAmount);
    const receipt: RewardReceipt = previousReceipt ?? {
      runId: input.runId,
      completionId,
      rewardId: input.rewardId,
      source: input.source,
      grantedAmount: previousAmount,
      lifetimePointsBefore: current.lifetimePoints,
      lifetimePointsAfter: current.lifetimePoints,
      fromLevel: current.level,
      toLevel: current.level,
      updatedAt: Date.now(),
    };
    if (add === 0) {
      const lockedReceipt = legacyLocked
        ? {
            ...receipt,
            grantedAmount: targetAmount,
            lifetimePointsBefore: current.lifetimePoints,
            lifetimePointsAfter: current.lifetimePoints,
            fromLevel: current.level,
            toLevel: current.level,
            updatedAt: Date.now(),
          }
        : receipt;
      if (legacyLocked) {
        const lockedState: ProgressionState = {
          ...current,
          rewardReceipts: { ...current.rewardReceipts, [receiptKey]: lockedReceipt },
        };
        // Conservative migration: preserve the existing balance and permanently
        // mark the unknown historical entitlement as already paid.
        persist(lockedState, true);
        set(lockedState);
      }
      return {
        fromLevel: current.level,
        toLevel: current.level,
        rewards: [],
        enteredWorld: null,
        applied: false,
        grantedDelta: 0,
        receipt: lockedReceipt,
      };
    }
    const lifetimePoints = current.lifetimePoints + add;
    const info = progressFor(lifetimePoints);
    const rewards = rewardsBetween(current.level, info.level);
    const unlockedThemes = themesThroughWorld(info.world);
    const enteredWorld = info.world > current.world ? info.world : null;
    let activeTheme = current.activeTheme;
    if (enteredWorld !== null) {
      activeTheme = PROGRESSION_CONFIG.worldThemeId[enteredWorld] ?? activeTheme;
    }
    const claimedRewards = [...current.claimedRewards];
    for (const reward of rewards) {
      if (reward.kind === 'cosmetic' && !claimedRewards.includes(reward.id)) {
        claimedRewards.push(reward.id);
      }
      const rewardId = reward.kind === 'world' ? reward.themeId : reward.id;
      const rewardLevel = levelForReward(reward) ?? info.level;
      recordNextGoalCompletion('reward', `reward:${rewardLevel}:${rewardId}`);
    }
    const next: ProgressionState = {
      lifetimePoints,
      level: info.level,
      world: info.world,
      unlockedThemes,
      activeTheme,
      claimedRewards,
      appliedSettlements: current.appliedSettlements.includes(completionId)
        ? current.appliedSettlements
        : [...current.appliedSettlements, completionId].slice(-500),
      rewardReceipts: {
        ...current.rewardReceipts,
        [receiptKey]: {
          runId: input.runId,
          completionId,
          rewardId: input.rewardId,
          source: input.source,
          grantedAmount: targetAmount,
          lifetimePointsBefore: current.lifetimePoints,
          lifetimePointsAfter: lifetimePoints,
          fromLevel: current.level,
          toLevel: info.level,
          updatedAt: Date.now(),
        },
      },
    };
    // Balance and receipt share one MMKV value. Persisting this document is the
    // commit point, so a crash can expose neither half of the reward.
    persist(next, true);
    set(next);
    if (info.level > current.level) {
      useAnalyticsStore.getState().track('level_up', { level: info.level, world: info.world });
    }
    if (enteredWorld !== null) {
      useAnalyticsStore.getState().track('world_unlocked', { world: enteredWorld });
    }
    return {
      fromLevel: current.level,
      toLevel: info.level,
      rewards,
      enteredWorld,
      applied: true,
      grantedDelta: add,
      receipt: next.rewardReceipts[receiptKey],
    };
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

  enqueueReveal(reveal) {
    const current = get();
    if (current.reveal?.id === reveal.id || current.revealQueue.some((item) => item.id === reveal.id)) {
      return;
    }
    set({ revealQueue: [...current.revealQueue, reveal].slice(-8) });
  },
  presentRevealForRun(runId) {
    const current = get();
    if (current.reveal) return;
    const index = current.revealQueue.findIndex((item) => item.runId === runId);
    if (index < 0) return;
    const reveal = current.revealQueue[index];
    set({
      reveal,
      revealQueue: current.revealQueue.filter((_, itemIndex) => itemIndex !== index),
    });
  },
  clearReveal() {
    set({ reveal: null });
  },
  discardRevealsForRun(runId) {
    const current = get();
    set({
      reveal: !runId || current.reveal?.runId === runId ? null : current.reveal,
      revealQueue: runId
        ? current.revealQueue.filter((item) => item.runId !== runId)
        : [],
    });
  },
}));
