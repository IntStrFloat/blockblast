import type {
  BackendProfileSession,
  AdventureSeasonWindow,
  RankedTicket,
  RunMove,
  WeeklyImpact,
  WeeklyLeaderboardSnapshot,
  WeeklyClaimReceipt,
  WeeklyOutcomesResponse,
  WeeklyServerOutcome,
} from './types';
import { createRemoteLeaderboardClient } from './remoteClient';

export interface LeaderboardClient {
  kind: 'local' | 'remote';
  bootstrapProfile: (input: {
    nickname: string;
    authToken?: string | null;
  }) => Promise<BackendProfileSession | null>;
  renameProfile: (input: {
    authToken: string;
    nickname: string;
  }) => Promise<{ nickname: string; tag: string }>;
  issueTickets: (input: { authToken: string }) => Promise<RankedTicket[]>;
  getWeeklySnapshot: (input: { authToken?: string }) => Promise<WeeklyLeaderboardSnapshot | null>;
  getWeeklyOutcomes?: (input: { authToken: string }) => Promise<WeeklyOutcomesResponse>;
  claimWeeklyReward?: (input: {
    authToken: string;
    rewardId: string;
  }) => Promise<{ outcome: WeeklyServerOutcome; receipt: WeeklyClaimReceipt }>;
  getAdventureSeason?: (input: { authToken: string }) => Promise<AdventureSeasonWindow | null>;
  submitRun: (input: {
    authToken: string;
    proofId: string;
    ticketId: string | null;
    score: number;
    seed: number;
    moves: RunMove[];
    durationMs: number;
    /** Витринный образ Капи (retention фаза 3); сервер хранит последний присланный. */
    avatar?: string | null;
  }) => Promise<{ snapshot?: WeeklyLeaderboardSnapshot; impact?: WeeklyImpact } | null>;
}

export type { BackendProfileSession } from './types';
export { createRemoteLeaderboardClient } from './remoteClient';

export function hasRemoteLeaderboardConfig() {
  return Boolean(process.env.EXPO_PUBLIC_API_URL);
}

export function createLeaderboardClient(): LeaderboardClient {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) {
    return {
      kind: 'local',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: '' }),
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      getWeeklyOutcomes: async () => ({ outcomes: [], effectScope: 'local_profile' }),
      claimWeeklyReward: async () => {
        throw new Error('remote_unavailable');
      },
      getAdventureSeason: async () => null,
      submitRun: async () => null,
    };
  }

  return createRemoteLeaderboardClient(apiUrl);
}
