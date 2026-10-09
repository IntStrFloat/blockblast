import { PROGRESSION_CONFIG, type ProgressionConfig } from './config';
import { thresholdForLevel, levelForPoints } from './levels';
import { worldForLevel, isWorldStart, nextWorldLevel } from './worlds';
import type { HelperId, LevelReward, Stage } from './types';

/** Уровень, на котором помощник выдаётся наградой (источник истины — levelRewards), или null. */
export function helperUnlockLevel(
  helper: HelperId,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): number | null {
  for (const [lvl, reward] of Object.entries(cfg.levelRewards)) {
    if (reward && reward.kind === 'helper' && reward.id === helper) return Number(lvl);
  }
  return null;
}

/** Разблокирован ли помощник на данном Уровне Игры (гейт для маскота, спека 15 §3). */
export function isHelperUnlocked(
  helper: HelperId,
  level: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): boolean {
  const unlockAt = helperUnlockLevel(helper, cfg);
  return unlockAt !== null && Math.floor(level) >= unlockAt;
}

export function stageForLevel(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): Stage {
  const world = worldForLevel(level, cfg);
  let stage: Stage = 1;
  for (let w = 1; w <= world; w++) {
    const s = cfg.evolutionAtWorld[w];
    if (s !== undefined) stage = s;
  }
  return stage;
}

export function rewardForLevel(
  level: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): LevelReward | null {
  const L = Math.floor(level);
  if (L < 1) return null;
  if (L > 1 && isWorldStart(L, cfg)) {
    const world = worldForLevel(L, cfg);
    const themeId = cfg.worldThemeId[world];
    if (themeId !== undefined) {
      const evolveStage = cfg.evolutionAtWorld[world];
      return evolveStage !== undefined
        ? { kind: 'world', world, themeId, evolveStage }
        : { kind: 'world', world, themeId };
    }
  }
  return cfg.levelRewards[L] ?? null;
}

export function rewardsBetween(
  fromLevelExcl: number,
  toLevelIncl: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): LevelReward[] {
  const out: LevelReward[] = [];
  for (let L = Math.floor(fromLevelExcl) + 1; L <= Math.floor(toLevelIncl); L++) {
    const r = rewardForLevel(L, cfg);
    if (r !== null) out.push(r);
  }
  return out;
}

export function levelForReward(
  reward: LevelReward,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): number | null {
  const rewardId = reward.kind === 'world' ? reward.themeId : reward.id;
  for (let level = 1; level <= cfg.maxAuthoredLevel; level += 1) {
    const candidate = rewardForLevel(level, cfg);
    const candidateId = candidate?.kind === 'world' ? candidate.themeId : candidate?.id;
    if (candidate?.kind === reward.kind && candidateId === rewardId) return level;
  }
  return null;
}

export interface RewardMilestone {
  level: number;
  threshold: number;
  reward: LevelReward;
  remaining: number;
  available: boolean;
}

/**
 * The next concrete reward in the player's current world segment. Once every
 * reward in that segment is open, Home can fall back to the weekly goal
 * instead of promising an ever more distant unlock.
 */
export function nextRewardInCurrentWorld(
  lifetimePoints: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): RewardMilestone | null {
  const points = Math.max(0, Math.floor(lifetimePoints));
  const currentLevel = levelForPoints(points, cfg);
  const nextWorld = nextWorldLevel(currentLevel, cfg);

  for (let level = currentLevel; level < (nextWorld ?? cfg.maxAuthoredLevel + 1); level += 1) {
    const reward = rewardForLevel(level, cfg);
    if (!reward) continue;
    const threshold = thresholdForLevel(level, cfg);
    if (threshold < points) continue;
    return {
      level,
      threshold,
      reward,
      remaining: Math.max(0, threshold - points),
      available: points >= threshold,
    };
  }
  return null;
}

/** Nearest authored reward regardless of world, used on result screens. */
export function nextRewardMilestone(
  lifetimePoints: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): RewardMilestone | null {
  const points = Math.max(0, Math.floor(lifetimePoints));
  for (let level = 1; level <= cfg.maxAuthoredLevel; level += 1) {
    const reward = rewardForLevel(level, cfg);
    if (!reward) continue;
    const threshold = thresholdForLevel(level, cfg);
    if (threshold < points) continue;
    return {
      level,
      threshold,
      reward,
      remaining: Math.max(0, threshold - points),
      available: points >= threshold,
    };
  }
  return null;
}
