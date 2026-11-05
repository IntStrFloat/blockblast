import { KEYS, getJSON, getString, removeKey, setJSON, storage } from '@/core/storage';
import { useProgression } from '@/features/progression/store';

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
  removeKey(KEYS.leaderboardPrizes);
  removeKey(KEYS.leaderboardWeeklyOutcomes);
  removeKey(KEYS.profileAuth);
});

describe('leaderboard store', () => {
  it('persists each recorded move without rewriting unrelated leaderboard fields', () => {
    const store = createLeaderboardStore();
    store.getState().startRun({ startedAt: NOW.toISOString(), mode: 'weekly', seed: 501 });
    const unrelatedKeys = [
      KEYS.leaderboardSnapshot,
      KEYS.leaderboardRuns,
      KEYS.leaderboardDaily,
      KEYS.leaderboardTickets,
      KEYS.leaderboardPending,
      KEYS.leaderboardPrizes,
      KEYS.leaderboardWeeklyOutcomes,
    ];
    const previousValues = unrelatedKeys.map((key) => getString(key));
    const write = jest.spyOn(storage, 'set');
    const moves = [
      { trayIndex: 0, row: 0, col: 0 },
      { trayIndex: 1, row: 2, col: 3 },
    ];

    try {
      moves.forEach((move) => store.getState().recordMove(move));

      expect(getJSON(KEYS.leaderboardActiveProof)).toEqual(store.getState().activeProof);
      expect(store.getState().activeProof?.moves).toEqual(moves);
      expect(unrelatedKeys.map((key) => getString(key))).toEqual(previousValues);
      expect(write.mock.calls.map(([key]) => key)).toEqual([
        KEYS.leaderboardActiveProof,
        KEYS.leaderboardActiveProof,
      ]);
    } finally {
      write.mockRestore();
    }
  });

  it('keeps recording in memory when the best-effort proof write fails', () => {
    const store = createLeaderboardStore();
    const previousProof = store.getState().startRun({
      startedAt: NOW.toISOString(), mode: 'weekly', seed: 501,
    });
    const write = jest.spyOn(storage, 'set').mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });
    const move = { trayIndex: 0, row: 0, col: 0 };

    try {
      expect(() => store.getState().recordMove(move)).not.toThrow();
      expect(store.getState().activeProof?.moves).toEqual([move]);
      expect(getJSON(KEYS.leaderboardActiveProof)).toEqual(previousProof);
    } finally {
      write.mockRestore();
    }
  });

  it('refreshes a recent snapshot immediately when Moscow weekKey changed', async () => {
    const store = createLeaderboardStore({
      profile: {
        nickname: 'LimeComet',
        normalizedNickname: 'limecomet',
        tag: '00H',
        seed: 7,
      },
    });
    const stale = await store.getState().refresh(new Date('2026-07-05T20:59:59.000Z'));
    expect(stale.weekKey).toBe('2026-06-29');

    const refreshed = await store.getState().refreshIfStale(
      new Date('2026-07-05T21:00:00.000Z'),
      Number.MAX_SAFE_INTEGER,
    );

    expect(refreshed.weekKey).toBe('2026-07-06');
  });

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

  it('uses the server receipt and applies its local G03 effect exactly once', async () => {
    let receipt: {
      receiptId: string;
      rewardId: string;
      weekKey: string;
      rank: number;
      prize: { rank: number; points: number; cosmeticId: string };
      claimedAt: string;
      effectScope: 'local_profile';
    } | null = null;
    const baseOutcome = {
      weekKey: '2026-06-15',
      finalizedAt: '2026-06-22T00:00:00.000Z',
      rank: 2,
      weeklyBest: 5_000,
      runsCount: 4,
      achievedAt: '2026-06-16T00:00:00.000Z',
      reward: {
        rewardId: 'weekly:reward-2',
        prize: { rank: 2, points: 700, cosmeticId: 'face-monocle' },
      },
    };
    const claimWeeklyReward = jest.fn(async () => {
      receipt ??= {
        receiptId: 'receipt:weekly:reward-2',
        rewardId: 'weekly:reward-2',
        weekKey: '2026-06-15',
        rank: 2,
        prize: baseOutcome.reward.prize,
        claimedAt: '2026-06-22T00:01:00.000Z',
        effectScope: 'local_profile',
      };
      return { outcome: { ...baseOutcome, receipt }, receipt };
    });
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      getWeeklyOutcomes: async () => ({
        outcomes: [{ ...baseOutcome, receipt }],
        effectScope: 'local_profile',
      }),
      claimWeeklyReward,
      submitRun: async () => null,
    };
    useProgression.setState({
      lifetimePoints: 0,
      level: 1,
      world: 1,
      unlockedThemes: ['classic'],
      activeTheme: 'classic',
      claimedRewards: [],
      appliedSettlements: [],
      rewardReceipts: {},
    });
    const store = createLeaderboardStore({ client });
    await store.getState().syncWeeklyOutcomes('auth-1');

    const [first, second] = await Promise.all([
      store.getState().claimWeeklyPrize('weekly:reward-2', 'auth-1'),
      store.getState().claimWeeklyPrize('weekly:reward-2', 'auth-1'),
    ]);

    expect(claimWeeklyReward).toHaveBeenCalledTimes(1);
    expect(first?.receipt).toEqual(second?.receipt);
    expect(first).toMatchObject({ claimed: true, localAppliedAt: expect.any(String) });
    expect(useProgression.getState().lifetimePoints).toBe(700);
    store.getState().reconcileWeeklyPrizeEffects();
    expect(useProgression.getState().lifetimePoints).toBe(700);
  });

  it('keeps cached final outcomes visible when prize refresh is offline', async () => {
    const cachedOutcome = {
      weekKey: '2026-06-15',
      finalizedAt: '2026-06-22T00:00:00.000Z',
      rank: 10,
      weeklyBest: 900,
      runsCount: 1,
      achievedAt: '2026-06-16T00:00:00.000Z',
      reward: null,
      receipt: null,
    };
    setJSON(KEYS.leaderboardWeeklyOutcomes, [cachedOutcome]);
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      getWeeklyOutcomes: async () => { throw new Error('offline'); },
      submitRun: async () => null,
    };
    const store = createLeaderboardStore({ client });

    const outcomes = await store.getState().syncWeeklyOutcomes('auth-1');

    expect(outcomes).toEqual([cachedOutcome]);
    expect(store.getState()).toMatchObject({
      weeklyOutcomes: [cachedOutcome],
      prizeSyncState: 'offline',
      prizeLastError: 'offline',
    });
  });

  it('recovers a server receipt after a lost claim response', async () => {
    const reward = {
      rewardId: 'weekly:lost-response',
      prize: { rank: 1, points: 1_200, cosmeticId: 'hat-block-crown' },
    };
    let receipt: {
      receiptId: string;
      rewardId: string;
      weekKey: string;
      rank: number;
      prize: typeof reward.prize;
      claimedAt: string;
      effectScope: 'local_profile';
    } | null = null;
    const outcome = () => ({
      weekKey: '2026-06-15',
      finalizedAt: '2026-06-22T00:00:00.000Z',
      rank: 1,
      weeklyBest: 5_000,
      runsCount: 2,
      achievedAt: '2026-06-16T00:00:00.000Z',
      reward,
      receipt,
    });
    const claimWeeklyReward = jest.fn(async () => {
      receipt = {
        receiptId: 'receipt:weekly:lost-response',
        rewardId: reward.rewardId,
        weekKey: '2026-06-15',
        rank: 1,
        prize: reward.prize,
        claimedAt: '2026-06-22T00:01:00.000Z',
        effectScope: 'local_profile',
      };
      if (claimWeeklyReward.mock.calls.length === 1) throw new Error('response_lost');
      return { outcome: outcome(), receipt };
    });
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      getWeeklyOutcomes: async () => ({ outcomes: [outcome()], effectScope: 'local_profile' }),
      claimWeeklyReward,
      submitRun: async () => null,
    };
    useProgression.setState({
      lifetimePoints: 0,
      level: 1,
      world: 1,
      unlockedThemes: ['classic'],
      activeTheme: 'classic',
      claimedRewards: [],
      appliedSettlements: [],
      rewardReceipts: {},
    });
    const store = createLeaderboardStore({ client });
    await store.getState().syncWeeklyOutcomes('auth-1');

    expect(await store.getState().claimWeeklyPrize(reward.rewardId, 'auth-1')).toBeNull();
    const recovered = await store.getState().claimWeeklyPrize(reward.rewardId, 'auth-1');

    expect(recovered?.receipt?.receiptId).toBe('receipt:weekly:lost-response');
    expect(useProgression.getState().lifetimePoints).toBe(1_200);
  });

  it('applies a successful claim even when the follow-up outcomes GET is offline', async () => {
    const reward = {
      rewardId: 'weekly:post-ok-get-offline',
      prize: { rank: 3, points: 400, cosmeticId: 'acc-cape' },
    };
    const receipt = {
      receiptId: 'receipt:weekly:post-ok-get-offline',
      rewardId: reward.rewardId,
      weekKey: '2026-06-15',
      rank: 3,
      prize: reward.prize,
      claimedAt: '2026-06-22T00:01:00.000Z',
      effectScope: 'local_profile' as const,
    };
    const eligible = {
      weekKey: '2026-06-15',
      finalizedAt: '2026-06-22T00:00:00.000Z',
      rank: 3,
      weeklyBest: 2_000,
      runsCount: 2,
      achievedAt: '2026-06-16T00:00:00.000Z',
      reward,
      receipt: null,
    };
    const getWeeklyOutcomes = jest
      .fn()
      .mockResolvedValueOnce({ outcomes: [eligible], effectScope: 'local_profile' })
      .mockRejectedValueOnce(new Error('offline'));
    const client: LeaderboardClient = {
      kind: 'remote',
      bootstrapProfile: async () => null,
      renameProfile: async ({ nickname }) => ({ nickname, tag: 'SRV' }),
      issueTickets: async () => [],
      getWeeklySnapshot: async () => null,
      getWeeklyOutcomes,
      claimWeeklyReward: async () => ({
        outcome: { ...eligible, receipt },
        receipt,
      }),
      submitRun: async () => null,
    };
    useProgression.setState({
      lifetimePoints: 0,
      level: 1,
      world: 1,
      unlockedThemes: ['classic'],
      activeTheme: 'classic',
      claimedRewards: [],
      appliedSettlements: [],
      rewardReceipts: {},
    });
    const store = createLeaderboardStore({ client });
    await store.getState().syncWeeklyOutcomes('auth-1');

    const claimed = await store.getState().claimWeeklyPrize(reward.rewardId, 'auth-1');

    expect(claimed).toMatchObject({
      claimed: true,
      localAppliedAt: expect.any(String),
    });
    expect(useProgression.getState().lifetimePoints).toBe(400);
    expect(store.getState().prizeSyncState).toBe('offline');
  });

  it('preserves claimed legacy rewards without replaying their XP', () => {
    setJSON(KEYS.leaderboardPrizes, [{
      weekKey: '2026-06-08',
      rank: 1,
      prize: { rank: 1, points: 1_200, cosmeticId: 'hat-block-crown' },
      claimed: true,
      earnedAt: '2026-06-15T00:00:00.000Z',
    }]);
    useProgression.setState({ lifetimePoints: 0 });

    const store = createLeaderboardStore();

    expect(store.getState().weeklyPrizes[0]).toMatchObject({
      origin: 'legacy_local',
      claimed: true,
    });
    expect(useProgression.getState().lifetimePoints).toBe(0);
  });

  it('repairs a persisted server receipt locally on cold start while offline', () => {
    setJSON(KEYS.leaderboardPrizes, [{
      rewardId: 'weekly:cold-receipt',
      weekKey: '2026-06-15',
      rank: 3,
      prize: { rank: 3, points: 400, cosmeticId: 'acc-cape' },
      claimed: true,
      earnedAt: '2026-06-22T00:00:00.000Z',
      receipt: {
        receiptId: 'receipt:weekly:cold-receipt',
        rewardId: 'weekly:cold-receipt',
        weekKey: '2026-06-15',
        rank: 3,
        prize: { rank: 3, points: 400, cosmeticId: 'acc-cape' },
        claimedAt: '2026-06-22T00:01:00.000Z',
        effectScope: 'local_profile',
      },
      origin: 'server',
      localAppliedAt: null,
    }]);
    useProgression.setState({
      lifetimePoints: 0,
      level: 1,
      world: 1,
      unlockedThemes: ['classic'],
      activeTheme: 'classic',
      claimedRewards: [],
      appliedSettlements: [],
      rewardReceipts: {},
    });

    const store = createLeaderboardStore();

    expect(useProgression.getState().lifetimePoints).toBe(400);
    expect(store.getState().weeklyPrizes[0].localAppliedAt).toEqual(expect.any(String));
    store.getState().reconcileWeeklyPrizeEffects();
    expect(useProgression.getState().lifetimePoints).toBe(400);
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
