import { KEYS, getJSON, removeKey } from '@/core/storage';

import { createLeaderboardStore } from '../store';
import type { LeaderboardClient } from '../client';

const NOW = new Date('2026-06-13T12:00:00.000Z');

beforeEach(() => {
  removeKey(KEYS.leaderboardActiveProof);
  removeKey(KEYS.leaderboardRuns);
  removeKey(KEYS.leaderboardSnapshot);
  removeKey(KEYS.leaderboardDaily);
  removeKey(KEYS.leaderboardPending);
  removeKey(KEYS.leaderboardTickets);
  removeKey(KEYS.profileAuth);
});

describe('leaderboard store', () => {
  it('shows an honest current-player-only state offline with no cached remote snapshot', async () => {
    const store = createLeaderboardStore({
      profile: {
        nickname: 'LimeComet',
        normalizedNickname: 'limecomet',
        tag: '00H',
        seed: 7,
      },
    });

    const snapshot = await store.getState().refresh(NOW);

    expect(snapshot.entries).toEqual([]);
    expect(snapshot.currentPlayer).toEqual({
      nickname: 'LimeComet',
      tag: '00H',
      rank: null,
      weeklyBest: 0,
      runsCount: 0,
      achievedAt: null,
      isCurrentPlayer: true,
    });
    expect(store.getState().viewState).toBe('empty');
  });

  it('consumes a ranked ticket and queues the submission on remote failure', async () => {
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [
        { ticketId: 'ticket-1', seed: 501, expiresAt: '2026-06-20T00:00:00.000Z' },
      ],
      getWeeklySnapshot: async () => null,
      submitRun: async () => {
        throw new Error('offline');
      },
    };

    const store = createLeaderboardStore({
      profile: {
        nickname: 'LimeComet',
        normalizedNickname: 'limecomet',
        tag: '00H',
        seed: 7,
      },
      client,
    });

    await store.getState().issueTickets('auth-1');
    store.getState().startRun({ startedAt: NOW.toISOString(), mode: 'weekly' });
    store.getState().recordMove({ trayIndex: 0, row: 0, col: 0 });
    const impact = await store.getState().finishActiveRun(2400, NOW);

    expect(impact).toEqual({
      score: 2400,
      weeklyBest: 2400,
      rank: null,
      rankDelta: null,
      improved: true,
      queued: true,
    });
    expect(store.getState().pendingSubmissions).toHaveLength(1);
    expect(store.getState().pendingSubmissions[0]).toMatchObject({
      ticketId: 'ticket-1',
      score: 2400,
      queuedAt: NOW.toISOString(),
    });
    expect(store.getState().tickets).toEqual([]);
  });

  it('bounds the pending submission queue to twenty newest items', async () => {
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () =>
        Array.from({ length: 25 }, (_, index) => ({
          ticketId: `ticket-${index}`,
          seed: 600 + index,
          expiresAt: '2026-06-20T00:00:00.000Z',
        })),
      getWeeklySnapshot: async () => null,
      submitRun: async () => {
        throw new Error('offline');
      },
    };

    const store = createLeaderboardStore({
      profile: {
        nickname: 'LimeComet',
        normalizedNickname: 'limecomet',
        tag: '00H',
        seed: 7,
      },
      client,
    });

    await store.getState().issueTickets('auth-1');
    for (let index = 0; index < 25; index += 1) {
      store.getState().startRun({
        startedAt: new Date(NOW.getTime() + index * 1000).toISOString(),
        mode: 'weekly',
      });
      await store.getState().finishActiveRun(1000 + index, new Date(NOW.getTime() + index * 1000));
    }

    expect(store.getState().pendingSubmissions).toHaveLength(20);
    expect(store.getState().pendingSubmissions[0].ticketId).toBe('ticket-5');
    expect(store.getState().pendingSubmissions[19].ticketId).toBe('ticket-24');
  });

  it('retries queued submissions and persists a cached remote snapshot', async () => {
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [
        { ticketId: 'ticket-1', seed: 501, expiresAt: '2026-06-20T00:00:00.000Z' },
      ],
      getWeeklySnapshot: async () => null,
      submitRun: async () => ({
        impact: {
          score: 2400,
          weeklyBest: 2400,
          rank: 8,
          rankDelta: 2,
          improved: true,
          queued: false,
        },
        snapshot: {
          weekKey: '2026-06-09',
          weekStartIso: '2026-06-09T00:00:00.000Z',
          weekEndIso: '2026-06-16T00:00:00.000Z',
          generatedAt: NOW.toISOString(),
          source: 'remote',
          isCached: false,
          currentPlayer: {
            nickname: 'LimeComet',
            tag: 'SRV',
            rank: 8,
            weeklyBest: 2400,
            runsCount: 1,
            achievedAt: NOW.toISOString(),
            isCurrentPlayer: true,
          },
          entries: [],
        },
      }),
    };

    const store = createLeaderboardStore({
      profile: {
        nickname: 'LimeComet',
        normalizedNickname: 'limecomet',
        tag: '00H',
        seed: 7,
      },
      client,
    });

    store.setState({
      pendingSubmissions: [
        {
          proofId: 'weekly:501:2026-06-13T12:00:00.000Z',
          ticketId: 'ticket-1',
          seed: 501,
          score: 2400,
          durationMs: 120000,
          moves: [{ trayIndex: 0, row: 0, col: 0 }],
          queuedAt: NOW.toISOString(),
        },
      ],
    });

    await store.getState().flushPending('auth-1');

    expect(store.getState().pendingSubmissions).toEqual([]);
    expect(store.getState().snapshot?.source).toBe('remote');
    expect(getJSON(KEYS.leaderboardSnapshot)).toEqual(store.getState().snapshot);
  });
});
