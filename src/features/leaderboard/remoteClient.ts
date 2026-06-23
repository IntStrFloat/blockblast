import type {
  BackendProfileSession,
  RankedTicket,
  RunMove,
  WeeklyImpact,
  WeeklyLeaderboardSnapshot,
} from './types';

interface RequestInitExtra extends RequestInit {
  authToken?: string;
}

export function createRemoteLeaderboardClient(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  return {
    kind: 'remote' as const,

    async bootstrapProfile(input: {
      nickname: string;
      authToken?: string | null;
    }): Promise<BackendProfileSession> {
      return requestJson<BackendProfileSession>(`${normalizedBaseUrl}/api/profile/bootstrap`, {
        method: 'POST',
        authToken: input.authToken ?? undefined,
        body: JSON.stringify({ nickname: input.nickname }),
      });
    },

    async renameProfile(input: {
      authToken: string;
      nickname: string;
    }): Promise<{ nickname: string; tag: string }> {
      const response = await requestJson<{ profile: { nickname: string; tag: string } }>(
        `${normalizedBaseUrl}/api/profile/rename`,
        {
          method: 'POST',
          authToken: input.authToken,
          body: JSON.stringify({ nickname: input.nickname }),
        },
      );
      return response.profile;
    },

    async issueTickets(input: { authToken: string }): Promise<RankedTicket[]> {
      const response = await requestJson<{ tickets: RankedTicket[] }>(`${normalizedBaseUrl}/api/tickets`, {
        method: 'POST',
        authToken: input.authToken,
      });
      return response.tickets;
    },

    async getWeeklySnapshot(input: { authToken?: string }): Promise<WeeklyLeaderboardSnapshot> {
      const snapshot = await requestJson<WeeklyLeaderboardSnapshot>(`${normalizedBaseUrl}/api/leaderboard`, {
        method: 'GET',
        authToken: input.authToken,
      });
      return { ...snapshot, source: 'remote', isCached: false };
    },

    async submitRun(input: {
      authToken: string;
      ticketId: string | null;
      score: number;
      seed: number;
      moves: RunMove[];
      durationMs: number;
    }): Promise<{ snapshot?: WeeklyLeaderboardSnapshot; impact?: WeeklyImpact }> {
      return requestJson<{ snapshot?: WeeklyLeaderboardSnapshot; impact?: WeeklyImpact }>(
        `${normalizedBaseUrl}/api/runs`,
        {
          method: 'POST',
          authToken: input.authToken,
          body: JSON.stringify({
            ticketId: input.ticketId,
            score: input.score,
            seed: input.seed,
            moves: input.moves,
            durationMs: input.durationMs,
          }),
        },
      );
    },
  };
}

async function requestJson<T>(url: string, init: RequestInitExtra): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      ...(init.authToken ? { Authorization: `Bearer ${init.authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`request_failed:${response.status}`);
  }

  return (await response.json()) as T;
}
