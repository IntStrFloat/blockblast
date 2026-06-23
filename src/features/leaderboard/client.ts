import type {
  BackendProfileSession,
  RankedTicket,
  RunMove,
  WeeklyImpact,
  WeeklyLeaderboardSnapshot,
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
  submitRun: (input: {
    authToken: string;
    ticketId: string | null;
    score: number;
    seed: number;
    moves: RunMove[];
    durationMs: number;
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
      submitRun: async () => null,
    };
  }

  return createRemoteLeaderboardClient(apiUrl);
}
