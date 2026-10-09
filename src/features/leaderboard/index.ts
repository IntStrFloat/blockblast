export {
  createLeaderboardClient,
  createRemoteLeaderboardClient,
  hasRemoteLeaderboardConfig,
  type BackendProfileSession,
  type LeaderboardClient,
} from './client';
export { WeeklyCard } from './components/WeeklyCard';
export { Podium } from './components/Podium';
export { LeaderboardRow } from './components/LeaderboardRow';
export {
  weeklyStatusLabel,
  selectEffectiveWeeklyBest,
  selectPreviousWeeklyBest,
  selectMyChampionRank,
  resolveWeeklyView,
  type ResolvedWeeklyView,
} from './presentation';
export {
  WEEKLY_PRIZES,
  championRankOf,
  isPrizeRank,
  prizeForRank,
  unclaimedPrize,
  normalizeWeeklyPrizeRecord,
  weeklyPrizeRecordFromOutcome,
} from './weeklyPrize';
export type { WeeklyPrize, WeeklyPrizeRecord } from './weeklyPrize';
export { appendRunMove, beginRunProof, finalizeRunProof } from './runProof';
export { createLeaderboardStore, useLeaderboardStore } from './store';
export { currentWeeklyGoal, useWeeklyGoalStore } from './weeklyGoalStore';
export type { WeeklyGoalRecord } from './weeklyGoalStore';
export { useWeeklyGoalWeekKey } from './useWeeklyGoalWeekKey';
export {
  getUtcWeekCountdown,
  getUtcWeekWindow,
  getWeeklyGoal,
} from './week';
export type {
  LeaderboardEntry,
  LocalWeeklyResult,
  ProfileIdentity,
  RunMode,
  RunMove,
  RunProof,
  VerifiedRun,
  WeeklyImpact,
  WeeklyLeaderboardSnapshot,
} from './types';
