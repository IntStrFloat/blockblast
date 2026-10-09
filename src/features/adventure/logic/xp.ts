import { isMilestone } from './levels';

export type AdventureRewardStage = 1 | 2 | 3 | 4;
export type AdventureRewardDifficulty = 'standard' | 'milestone';

export interface AdventureXpRewardRow {
  stage: AdventureRewardStage;
  levelFrom: number;
  levelTo: number;
  standard: number;
  milestone: number;
}

/**
 * First-clear XP for the four quarters of the 96-level personal campaign.
 * Values stay flat until measured late-campaign completion times justify an
 * uplift. Every sixth milestone gets a bounded difficulty premium.
 */
export const ADVENTURE_XP_REWARDS: readonly AdventureXpRewardRow[] = [
  { stage: 1, levelFrom: 1, levelTo: 24, standard: 500, milestone: 650 },
  { stage: 2, levelFrom: 25, levelTo: 48, standard: 500, milestone: 650 },
  { stage: 3, levelFrom: 49, levelTo: 72, standard: 500, milestone: 650 },
  { stage: 4, levelFrom: 73, levelTo: 96, standard: 500, milestone: 650 },
] as const;

export interface AdventureCompletionIdentity {
  completionId: string;
  campaign: 'personal';
  seasonId: number;
  levelIndex: number;
}

/** Stable entitlement identity: attempts/runs of the same personal level share it. */
export function adventureCompletionIdentity(
  seasonId: number,
  levelIndex: number,
): AdventureCompletionIdentity {
  const normalizedSeason = Math.max(1, Math.floor(seasonId));
  const normalizedIndex = Math.max(0, Math.floor(levelIndex));
  return {
    completionId: `adventure:personal:s${normalizedSeason}:l${normalizedIndex + 1}`,
    campaign: 'personal',
    seasonId: normalizedSeason,
    levelIndex: normalizedIndex,
  };
}

export function adventureRewardStage(levelIndex: number): AdventureRewardStage {
  const level = Math.max(1, Math.floor(levelIndex) + 1);
  return ADVENTURE_XP_REWARDS.find((row) => level <= row.levelTo)?.stage ?? 4;
}

/** First-clear only; replay protection is enforced by the G03 completion receipt. */
export function adventureXpForLevel(levelIndex: number): number {
  const level = Math.max(1, Math.floor(levelIndex) + 1);
  const row = ADVENTURE_XP_REWARDS.find(
    (candidate) => level >= candidate.levelFrom && level <= candidate.levelTo,
  ) ?? ADVENTURE_XP_REWARDS[ADVENTURE_XP_REWARDS.length - 1];
  const difficulty: AdventureRewardDifficulty = isMilestone(levelIndex)
    ? 'milestone'
    : 'standard';
  return row[difficulty];
}
