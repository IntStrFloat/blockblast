import { KEYS, getJSON, removeKey } from '@/core/storage';

import { createLeaderboardStore } from '../store';
import type { LeaderboardClient } from '../client';
import type { WeeklyLeaderboardSnapshot } from '../types';

const NOW = new Date('2026-06-13T12:00:00.000Z');

beforeEach(() => {
  removeKey(KEYS.leaderboardActiveProof);
  removeKey(KEYS.leaderboardRuns);
  removeKey(KEYS.leaderboardSnapshot);
  removeKey(KEYS.leaderboardDaily);
  removeKey(KEYS.leaderboardPending);
  removeKey(KEYS.leaderboardTickets);
  removeKey(KEYS.leaderboardPrizes);
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

  it('plays each weekly run on its ticket seed and rotates tickets across re-issues', async () => {
    const pool = [
      { ticketId: 'ticket-1', seed: 111, expiresAt: '2026-06-20T00:00:00.000Z' },
      { ticketId: 'ticket-2', seed: 222, expiresAt: '2026-06-20T00:00:00.000Z' },
    ];
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => pool.map((ticket) => ({ ...ticket })),
      getWeeklySnapshot: async () => null,
      submitRun: async () => null,
    };
    const store = createLeaderboardStore({ client });
    await store.getState().issueTickets('auth-1');

    const p1 = store.getState().startRun({ startedAt: NOW.toISOString(), mode: 'weekly', seed: 999 });
    // Сид игры = сид тикета (сервер требует совпадения), а не переданный 999.
    expect(p1.seed).toBe(111);
    expect(p1.ranked).toBe(true);
    expect(p1.ticketId).toBe('ticket-1');

    // Возврат на домашний экран переаутвыдаёт тот же серверный пул; уже
    // использованный ticket-1 не должен переиспользоваться → другой сид.
    await store.getState().issueTickets('auth-1');
    const p2 = store.getState().startRun({ startedAt: NOW.toISOString(), mode: 'weekly', seed: 999 });
    expect(p2.seed).toBe(222);
    expect(p2.ticketId).toBe('ticket-2');
  });

  it('reopens a finished run after a revive and submits the revive score too (record-only)', async () => {
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [
        { ticketId: 'ticket-1', seed: 5, expiresAt: '2026-06-20T00:00:00.000Z' },
      ],
      getWeeklySnapshot: async () => null,
      submitRun: async () => {
        throw new Error('offline');
      },
    };
    const store = createLeaderboardStore({ client });
    await store.getState().issueTickets('auth-1');

    store.getState().startRun({ startedAt: NOW.toISOString(), mode: 'weekly', seed: 1 });
    await store.getState().finishActiveRun(1000, NOW);
    expect(store.getState().localWeeklyResult).toMatchObject({ bestScore: 1000, runsCount: 1 });
    expect(store.getState().pendingSubmissions).toHaveLength(1);

    // Ревайв: ран переоткрыт и снят с ranked.
    store.getState().reopenActiveRun();
    expect(store.getState().activeProof?.frozenScore).toBeNull();
    expect(store.getState().activeProof?.ranked).toBe(false);
    expect(store.getState().activeProof?.continued).toBe(true);

    store.getState().recordMove({ trayIndex: 0, row: 0, col: 0 });
    await store.getState().finishActiveRun(1500, NOW);

    // Record-only: ревайв-рекорд ТОЖЕ уходит на сервер — вторым сабмитом без тикета.
    // Локальный недельный best поднят (без второй ПАРТИИ — runsCount не растёт).
    expect(store.getState().localWeeklyResult).toMatchObject({ bestScore: 1500, runsCount: 1 });
    expect(store.getState().pendingSubmissions).toHaveLength(2);
    expect(store.getState().pendingSubmissions[0]).toMatchObject({ score: 1000, ticketId: 'ticket-1' });
    expect(store.getState().pendingSubmissions[1]).toMatchObject({ score: 1500, ticketId: null });
  });

  it('replaces tickets from an obsolete auth session with the current pool', async () => {
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [
        { ticketId: 'current-ticket', seed: 777, expiresAt: '2026-06-20T00:00:00.000Z' },
      ],
      getWeeklySnapshot: async () => null,
      submitRun: async () => null,
    };
    const store = createLeaderboardStore({ client });
    store.setState({
      tickets: [
        { ticketId: 'obsolete-ticket', seed: 501, expiresAt: '2026-06-20T00:00:00.000Z' },
      ],
    });

    await store.getState().issueTickets('current-auth');

    expect(store.getState().tickets).toEqual([
      { ticketId: 'current-ticket', seed: 777, expiresAt: '2026-06-20T00:00:00.000Z' },
    ]);
  });

  it('tracks a local weekly best even when a run starts without a ranked ticket', async () => {
    const store = createLeaderboardStore();

    store.getState().startRun({ startedAt: NOW.toISOString(), mode: 'weekly', seed: 501 });
    await store.getState().finishActiveRun(2400, NOW);

    expect(store.getState().localWeeklyResult).toEqual({
      weekKey: '2026-06-08',
      bestScore: 2400,
      runsCount: 1,
      achievedAt: NOW.toISOString(),
    });
    expect(getJSON(KEYS.leaderboardRuns)).toEqual(store.getState().localWeeklyResult);
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

  it('settles a top-3 prize when the week rolls over, then claims it once', async () => {
    const lastWeek: WeeklyLeaderboardSnapshot = {
      weekKey: '2026-06-15',
      weekStartIso: '2026-06-15T00:00:00.000Z',
      weekEndIso: '2026-06-22T00:00:00.000Z',
      generatedAt: '2026-06-15T12:00:00.000Z',
      source: 'remote',
      isCached: false,
      currentPlayer: {
        nickname: 'LimeComet',
        tag: '00H',
        rank: 2,
        weeklyBest: 5000,
        runsCount: 4,
        achievedAt: '2026-06-16T00:00:00.000Z',
        isCurrentPlayer: true,
      },
      entries: [],
    };
    const store = createLeaderboardStore();
    store.setState({ snapshot: lastWeek });

    // Рефреш на следующей неделе подводит призы прошлой.
    await store.getState().refresh(new Date('2026-06-23T10:00:00.000Z'));

    const prizes = store.getState().weeklyPrizes;
    expect(prizes).toHaveLength(1);
    expect(prizes[0]).toMatchObject({ weekKey: '2026-06-15', rank: 2, claimed: false });

    const claimed = store.getState().claimWeeklyPrize('2026-06-15');
    expect(claimed?.claimed).toBe(true);
    expect(store.getState().weeklyPrizes[0].claimed).toBe(true);

    // Повторный claim не выдаёт награду второй раз.
    expect(store.getState().claimWeeklyPrize('2026-06-15')).toBeNull();
  });

  it('drops permanently rejected pending submissions but keeps transient failures', async () => {
    const submitRun = jest
      .fn()
      .mockRejectedValueOnce(new Error('request_failed:404'))
      .mockRejectedValueOnce(new Error('network unavailable'));
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      submitRun,
    };
    const store = createLeaderboardStore({ client });
    store.setState({
      pendingSubmissions: [
        {
          proofId: 'obsolete-proof',
          ticketId: 'obsolete-ticket',
          seed: 501,
          score: 1000,
          durationMs: 120000,
          moves: [],
          queuedAt: NOW.toISOString(),
        },
        {
          proofId: 'retry-proof',
          ticketId: 'retry-ticket',
          seed: 502,
          score: 1100,
          durationMs: 120000,
          moves: [],
          queuedAt: NOW.toISOString(),
        },
      ],
    });

    await store.getState().flushPending('current-auth');

    expect(store.getState().pendingSubmissions.map((submission) => submission.proofId)).toEqual([
      'retry-proof',
    ]);
  });
});
