import { create } from 'zustand';

import { KEYS, getJSON, getString, removeKey, setJSON } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';
import { createGeneratedProfile } from '@/features/profile/nickname';

import { createLeaderboardClient, type LeaderboardClient } from './client';
import { appendRunMove, beginRunProof, finalizeRunProof, reopenRunProof } from './runProof';
import type {
  LeaderboardViewState,
  LocalWeeklyResult,
  PendingSubmission,
  ProfileIdentity,
  RankedTicket,
  RunMove,
  RunMode,
  RunProof,
  WeeklyImpact,
  WeeklyLeaderboardSnapshot,
} from './types';
import { getUtcWeekWindow } from './week';
import { settleWeeklyPrize, type WeeklyPrizeRecord } from './weeklyPrize';

interface DailyResult {
  dateIso: string;
  bestScore: number;
}

interface LeaderboardState {
  snapshot: WeeklyLeaderboardSnapshot | null;
  activeProof: RunProof | null;
  latestImpact: WeeklyImpact | null;
  localWeeklyResult: LocalWeeklyResult | null;
  dailyResults: Record<string, DailyResult>;
  tickets: RankedTicket[];
  /** ticketId тикетов, уже использованных в этой сессии (ротация сидов). */
  consumedTicketIds: string[];
  pendingSubmissions: PendingSubmission[];
  /** Призы за топ-3 закрытых недель (claim-модель). */
  weeklyPrizes: WeeklyPrizeRecord[];
  viewState: LeaderboardViewState;
  lastError: 'offline' | 'remote_error' | null;
  startRun: (input: {
    startedAt: string;
    mode: RunMode;
    seed?: number;
    challengeDate?: string | null;
  }) => RunProof;
  recordMove: (move: RunMove) => void;
  reopenActiveRun: () => void;
  finishActiveRun: (score: number, now?: Date) => Promise<WeeklyImpact | null>;
  issueTickets: (authToken?: string | null) => Promise<RankedTicket[]>;
  flushPending: (authToken?: string | null) => Promise<void>;
  refresh: (now?: Date) => Promise<WeeklyLeaderboardSnapshot>;
  refreshIfStale: (now?: Date, staleMs?: number) => Promise<WeeklyLeaderboardSnapshot>;
  /** Пометить приз полученным; возвращает запись для выдачи наград вызывающим. */
  claimWeeklyPrize: (weekKey: string) => WeeklyPrizeRecord | null;
  resetForTests: (profile?: ProfileIdentity) => void;
}

interface CreateLeaderboardStoreOptions {
  profile?: ProfileIdentity;
  client?: LeaderboardClient;
}

function persistState(state: Pick<LeaderboardState, 'activeProof' | 'snapshot' | 'localWeeklyResult' | 'dailyResults' | 'tickets' | 'pendingSubmissions' | 'weeklyPrizes'>) {
  setJSON(KEYS.leaderboardActiveProof, state.activeProof);
  setJSON(KEYS.leaderboardSnapshot, state.snapshot);
  setJSON(KEYS.leaderboardRuns, state.localWeeklyResult);
  setJSON(KEYS.leaderboardDaily, state.dailyResults);
  setJSON(KEYS.leaderboardTickets, state.tickets);
  setJSON(KEYS.leaderboardPending, state.pendingSubmissions);
  setJSON(KEYS.leaderboardPrizes, state.weeklyPrizes);
}

/**
 * Подвести призы прошлой недели перед перезаписью снапшота новой неделей.
 * Возвращает обновлённый список призов (с новой записью, если игрок попал в топ-3).
 */
function settlePrizesFor(
  previous: WeeklyLeaderboardSnapshot | null,
  existing: readonly WeeklyPrizeRecord[],
  now: Date,
): WeeklyPrizeRecord[] {
  const currentWeekKey = getUtcWeekWindow(now).weekKey;
  const settled = settleWeeklyPrize(previous, currentWeekKey, existing, now);
  return settled ? [...existing, settled] : [...existing];
}

function resolveProfile(fallback?: ProfileIdentity): ProfileIdentity {
  return getJSON<ProfileIdentity>(KEYS.profileLocal) ?? fallback ?? createGeneratedProfile(7);
}

function createEmptySnapshot(profile: ProfileIdentity, now: Date, cached: boolean): WeeklyLeaderboardSnapshot {
  const week = getUtcWeekWindow(now);
  return {
    weekKey: week.weekKey,
    weekStartIso: week.weekStartIso,
    weekEndIso: week.weekEndIso,
    generatedAt: now.toISOString(),
    source: cached ? 'remote' : 'local',
    isCached: cached,
    currentPlayer: {
      nickname: profile.nickname,
      tag: profile.tag,
      rank: null,
      weeklyBest: 0,
      runsCount: 0,
      achievedAt: null,
      isCurrentPlayer: true,
    },
    entries: [],
  };
}

function clampPendingQueue(pendingSubmissions: PendingSubmission[]) {
  return pendingSubmissions.slice(-20);
}

function updateLocalWeeklyResult(
  previous: LocalWeeklyResult | null,
  score: number,
  now: Date,
  countRun = true,
): LocalWeeklyResult {
  const weekKey = getUtcWeekWindow(now).weekKey;
  const current = previous?.weekKey === weekKey ? previous : null;
  const improved = score > (current?.bestScore ?? 0);
  return {
    weekKey,
    bestScore: Math.max(current?.bestScore ?? 0, score),
    runsCount: (current?.runsCount ?? 0) + (countRun ? 1 : 0),
    achievedAt: improved ? now.toISOString() : (current?.achievedAt ?? now.toISOString()),
  };
}

function isPermanentSubmissionError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /request_failed:(400|401|403|404|409|410|422)\b/.test(message);
}

function applyRemoteSnapshot(
  snapshot: WeeklyLeaderboardSnapshot | undefined,
  previous: WeeklyLeaderboardSnapshot | null,
): WeeklyLeaderboardSnapshot | null {
  if (!snapshot) return previous;
  return {
    ...snapshot,
    source: 'remote' as const,
    isCached: false,
  };
}

function buildQueuedImpact(previous: WeeklyLeaderboardSnapshot | null, score: number): WeeklyImpact {
  return {
    score,
    weeklyBest: score,
    rank: previous?.currentPlayer.rank ?? null,
    rankDelta: null,
    improved: score > (previous?.currentPlayer.weeklyBest ?? 0),
    queued: true,
  };
}

function buildSuccessImpact(previous: WeeklyLeaderboardSnapshot | null, snapshot: WeeklyLeaderboardSnapshot, fallbackScore: number): WeeklyImpact {
  const previousRank = previous?.currentPlayer.rank ?? null;
  return {
    score: snapshot.currentPlayer.weeklyBest || fallbackScore,
    weeklyBest: snapshot.currentPlayer.weeklyBest,
    rank: snapshot.currentPlayer.rank,
    rankDelta:
      previousRank !== null && snapshot.currentPlayer.rank !== null
        ? previousRank - snapshot.currentPlayer.rank
        : null,
    improved: snapshot.currentPlayer.weeklyBest > (previous?.currentPlayer.weeklyBest ?? 0),
    queued: false,
  };
}

function consumeNextTicket(
  tickets: RankedTicket[],
  startedAt: string,
  consumedTicketIds: readonly string[] = [],
) {
  const startedMs = new Date(startedAt).getTime();
  const consumed = new Set(consumedTicketIds);
  const nextTicket =
    tickets.find(
      (ticket) =>
        !consumed.has(ticket.ticketId) &&
        new Date(ticket.expiresAt).getTime() > startedMs,
    ) ?? null;
  return {
    ticket: nextTicket,
    remaining: nextTicket ? tickets.filter((ticket) => ticket.ticketId !== nextTicket.ticketId) : tickets,
  };
}

export function createLeaderboardStore(options: CreateLeaderboardStoreOptions = {}) {
  if (options.profile) {
    setJSON(KEYS.profileLocal, options.profile);
  }

  const client = options.client ?? createLeaderboardClient();
  const initialActiveProof = getJSON<RunProof>(KEYS.leaderboardActiveProof);
  const initialSnapshot = getJSON<WeeklyLeaderboardSnapshot>(KEYS.leaderboardSnapshot);
  const initialLocalWeeklyResult = getJSON<LocalWeeklyResult>(KEYS.leaderboardRuns);
  const initialDaily = getJSON<Record<string, DailyResult>>(KEYS.leaderboardDaily) ?? {};
  const initialTickets = getJSON<RankedTicket[]>(KEYS.leaderboardTickets) ?? [];
  const initialPending = getJSON<PendingSubmission[]>(KEYS.leaderboardPending) ?? [];
  const initialPrizes = getJSON<WeeklyPrizeRecord[]>(KEYS.leaderboardPrizes) ?? [];

  const store = create<LeaderboardState>((set, get) => ({
    snapshot: initialSnapshot,
    activeProof: initialActiveProof,
    latestImpact: null,
    localWeeklyResult: initialLocalWeeklyResult,
    dailyResults: initialDaily,
    tickets: initialTickets,
    consumedTicketIds: [],
    pendingSubmissions: initialPending,
    weeklyPrizes: initialPrizes,
    viewState: initialSnapshot ? (initialSnapshot.isCached ? 'cached' : initialSnapshot.entries.length > 0 ? 'ready' : 'empty') : 'idle',
    lastError: null,

    startRun: (input) => {
      const startedAt = input.startedAt;
      const explicitSeed = input.seed ?? Math.floor(Date.now() % 2147483647);
      const ticketConsumption =
        input.mode === 'weekly'
          ? consumeNextTicket(get().tickets, startedAt, get().consumedTicketIds)
          : { ticket: null, remaining: get().tickets };
      const proof = beginRunProof({
        // Сид игры = сид тикета. Сервер требует seed == ticket.seed (backend
        // verify-run + server.cjs: seed_mismatch), и реплеит ходы по этому сиду —
        // иначе ranked-сабмит отклоняется. Разнообразие первых фигур даёт РОТАЦИЯ
        // тикетов (у каждого свой случайный серверный сид): каждая новая партия
        // берёт следующий неиспользованный тикет (см. consumedTicketIds).
        // Без тикета (пул исчерпан) — explicitSeed, но такой ран unranked.
        seed: ticketConsumption.ticket?.seed ?? explicitSeed,
        startedAt,
        mode: input.mode,
        challengeDate: input.challengeDate ?? null,
        ticket: ticketConsumption.ticket,
      });
      const consumedTicketIds = ticketConsumption.ticket
        ? [...get().consumedTicketIds, ticketConsumption.ticket.ticketId]
        : get().consumedTicketIds;
      set({
        activeProof: proof,
        latestImpact: null,
        tickets: ticketConsumption.remaining,
        consumedTicketIds,
      });
      persistState({ ...get(), activeProof: proof, tickets: ticketConsumption.remaining });
      return proof;
    },

    recordMove: (move) => {
      const activeProof = get().activeProof;
      if (!activeProof) return;
      const nextProof = appendRunMove(activeProof, move);
      set({ activeProof: nextProof });
      persistState({ ...get(), activeProof: nextProof });
    },

    reopenActiveRun: () => {
      const activeProof = get().activeProof;
      if (!activeProof || activeProof.frozenScore === null) return;
      const reopened = reopenRunProof(activeProof);
      set({ activeProof: reopened });
      persistState({ ...get(), activeProof: reopened });
    },

    finishActiveRun: async (score, now = new Date()) => {
      const existingProof = get().activeProof;
      if (!existingProof) return get().latestImpact;
      if (existingProof.frozenScore !== null) {
        return get().latestImpact;
      }
      const finishedProof = finalizeRunProof(existingProof, {
        score,
        finishedAt: now.toISOString(),
      });
      set({ activeProof: finishedProof });

      if (finishedProof.frozenScore === null) {
        persistState({ ...get(), activeProof: finishedProof });
        return get().latestImpact;
      }

      if (finishedProof.mode === 'daily' && finishedProof.challengeDate) {
        const previous = get().dailyResults[finishedProof.challengeDate];
        const dailyResults = {
          ...get().dailyResults,
          [finishedProof.challengeDate]: {
            dateIso: finishedProof.challengeDate,
            bestScore: Math.max(previous?.bestScore ?? 0, finishedProof.frozenScore),
          },
        };
        set({ dailyResults });
        persistState({ ...get(), activeProof: finishedProof, dailyResults });
        return null;
      }

      const localWeeklyResult = updateLocalWeeklyResult(
        get().localWeeklyResult,
        finishedProof.frozenScore,
        now,
        !finishedProof.continued,
      );
      set({ localWeeklyResult });
      persistState({ ...get(), activeProof: finishedProof, localWeeklyResult });

      // Record-only: лучший счёт уходит на сервер ПОСЛЕ КАЖДОЙ партии — включая
      // продолжённые после ревайва и сыгранные без тикета. Реплея больше нет
      // (backend record-only), поэтому старое ограничение «слать только ranked-раны»
      // снято: иначе ревайв-/безтикетные рекорды копились лишь локально и
      // расходились между устройствами (игрок видел себя выше, чем все остальные).
      // Сетевой сабмит ниже всё равно срабатывает лишь при remote-клиенте + authToken.

      const pending = clampPendingQueue([
        ...get().pendingSubmissions,
        {
          proofId: finishedProof.id,
          ticketId: finishedProof.ticketId,
          seed: finishedProof.seed,
          score: finishedProof.frozenScore,
          durationMs: Math.max(
            0,
            new Date(finishedProof.finishedAt ?? now.toISOString()).getTime() -
              new Date(finishedProof.startedAt).getTime(),
          ),
          moves: finishedProof.moves,
          queuedAt: now.toISOString(),
        },
      ]);

      set({ activeProof: finishedProof, pendingSubmissions: pending });
      persistState({ ...get(), activeProof: finishedProof, pendingSubmissions: pending });

      useAnalyticsStore.getState().track('ranked_run_finished', {
        mode: 'weekly',
        score: finishedProof.frozenScore,
      });

      const authToken = getString(KEYS.profileAuth);
      if (client.kind === 'remote' && authToken) {
        try {
          const response = await client.submitRun({
            authToken,
            ticketId: finishedProof.ticketId,
            score: finishedProof.frozenScore,
            seed: finishedProof.seed,
            moves: finishedProof.moves,
            durationMs: pending[pending.length - 1]?.durationMs ?? 0,
          });
          const snapshot = applyRemoteSnapshot(response?.snapshot ?? undefined, get().snapshot);
          const latestImpact =
            response?.impact ??
            (snapshot ? buildSuccessImpact(get().snapshot, snapshot, finishedProof.frozenScore) : buildQueuedImpact(get().snapshot, finishedProof.frozenScore));
          const remaining = get().pendingSubmissions.filter((submission) => submission.proofId !== finishedProof.id);
          set({
            snapshot: snapshot ?? get().snapshot,
            latestImpact,
            pendingSubmissions: remaining,
            viewState: snapshot ? (snapshot.entries.length > 0 ? 'ready' : 'empty') : get().viewState,
            lastError: null,
          });
          persistState({
            ...get(),
            snapshot: snapshot ?? get().snapshot,
            pendingSubmissions: remaining,
            activeProof: finishedProof,
          });
          return latestImpact;
        } catch {
          // Keep it queued below.
        }
      }

      const queuedImpact = buildQueuedImpact(get().snapshot, finishedProof.frozenScore);
      set({ latestImpact: queuedImpact });
      persistState({ ...get(), activeProof: finishedProof, pendingSubmissions: pending });
      return queuedImpact;
    },

    issueTickets: async (authToken = getString(KEYS.profileAuth)) => {
      if (client.kind !== 'remote' || !authToken) return get().tickets;
      try {
        const issuedTickets = await client.issueTickets({ authToken });
        // Не возвращаем в пул тикеты, уже использованные в этой сессии — иначе
        // новая партия снова взяла бы тот же тикет с тем же сидом (баг «одинаковые
        // первые фигуры» после возврата на домашний экран). Список использованных
        // чистим от тикетов, которые сервер больше не отдаёт (consumed/expired).
        const issuedIds = new Set(issuedTickets.map((ticket) => ticket.ticketId));
        const consumedTicketIds = get().consumedTicketIds.filter((id) => issuedIds.has(id));
        const consumed = new Set(consumedTicketIds);
        const tickets = issuedTickets.filter((ticket) => !consumed.has(ticket.ticketId));
        set({ tickets, consumedTicketIds });
        persistState({ ...get(), tickets });
        return tickets;
      } catch {
        return get().tickets;
      }
    },

    flushPending: async (authToken = getString(KEYS.profileAuth)) => {
      if (client.kind !== 'remote' || !authToken || get().pendingSubmissions.length === 0) return;

      let snapshot = get().snapshot;
      let latestImpact = get().latestImpact;
      const remaining: PendingSubmission[] = [];
      for (const submission of get().pendingSubmissions) {
        try {
          const response = await client.submitRun({
            authToken,
            ticketId: submission.ticketId,
            score: submission.score,
            seed: submission.seed,
            moves: submission.moves,
            durationMs: submission.durationMs,
          });
          snapshot = applyRemoteSnapshot(response?.snapshot ?? undefined, snapshot);
          if (response?.impact) {
            latestImpact = response.impact;
          } else if (snapshot) {
            latestImpact = buildSuccessImpact(get().snapshot, snapshot, submission.score);
          }
        } catch (error) {
          if (!isPermanentSubmissionError(error)) {
            remaining.push(submission);
          }
        }
      }

      set({
        pendingSubmissions: remaining,
        snapshot,
        latestImpact,
      });
      persistState({ ...get(), pendingSubmissions: remaining, snapshot });
    },

    refresh: async (now = new Date()) => {
      const profile = resolveProfile(options.profile);
      const authToken = getString(KEYS.profileAuth);

      // Подвести призы прошлой недели по последнему известному снапшоту, пока он
      // ещё отражает закрытую неделю (до перезаписи свежими данными).
      const settledPrizes = settlePrizesFor(get().snapshot, get().weeklyPrizes, now);
      if (settledPrizes.length !== get().weeklyPrizes.length) {
        set({ weeklyPrizes: settledPrizes });
        persistState({ ...get(), weeklyPrizes: settledPrizes });
      }

      set({ viewState: 'loading' });

      if (client.kind === 'remote' && authToken) {
        await get().issueTickets(authToken);
        await get().flushPending(authToken);
        try {
          const remoteSnapshot = await client.getWeeklySnapshot({ authToken });
          if (remoteSnapshot) {
            const normalized: WeeklyLeaderboardSnapshot = {
              ...remoteSnapshot,
              source: 'remote',
              isCached: false,
            };
            set({
              snapshot: normalized,
              viewState: normalized.entries.length > 0 ? 'ready' : 'empty',
              lastError: null,
            });
            persistState({ ...get(), snapshot: normalized });
            useAnalyticsStore.getState().track('leaderboard_loaded', { source: 'remote' });
            return normalized;
          }
        } catch {
          const currentSnapshot = get().snapshot;
          const cachedSnapshot: WeeklyLeaderboardSnapshot | null =
            currentSnapshot && currentSnapshot.source === 'remote'
              ? { ...currentSnapshot, isCached: true }
              : null;
          if (cachedSnapshot) {
            set({ snapshot: cachedSnapshot, viewState: 'cached', lastError: 'offline' });
            persistState({ ...get(), snapshot: cachedSnapshot });
            useAnalyticsStore.getState().track('leaderboard_loaded', { source: 'remote' });
            return cachedSnapshot;
          }
        }
      }

      const honestSnapshot = createEmptySnapshot(profile, now, false);
      set({ snapshot: honestSnapshot, viewState: 'empty', lastError: client.kind === 'remote' ? 'offline' : null });
      persistState({ ...get(), snapshot: honestSnapshot });
      useAnalyticsStore.getState().track('leaderboard_loaded', { source: 'local' });
      return honestSnapshot;
    },

    refreshIfStale: async (now = new Date(), staleMs = 60_000) => {
      const snapshot = get().snapshot;
      if (snapshot && now.getTime() - new Date(snapshot.generatedAt).getTime() < staleMs) {
        return snapshot;
      }
      return get().refresh(now);
    },

    claimWeeklyPrize: (weekKey) => {
      const record = get().weeklyPrizes.find((item) => item.weekKey === weekKey);
      if (!record || record.claimed) return null;
      const claimed: WeeklyPrizeRecord = { ...record, claimed: true };
      const weeklyPrizes = get().weeklyPrizes.map((item) =>
        item.weekKey === weekKey ? claimed : item,
      );
      set({ weeklyPrizes });
      persistState({ ...get(), weeklyPrizes });
      useAnalyticsStore.getState().track('weekly_prize_claimed', {
        rank: claimed.rank,
        weekKey: claimed.weekKey,
      });
      return claimed;
    },

    resetForTests: (profile = createGeneratedProfile(7)) => {
      setJSON(KEYS.profileLocal, profile);
      removeKey(KEYS.profileAuth);
      removeKey(KEYS.leaderboardActiveProof);
      removeKey(KEYS.leaderboardSnapshot);
      removeKey(KEYS.leaderboardRuns);
      removeKey(KEYS.leaderboardDaily);
      removeKey(KEYS.leaderboardPending);
      removeKey(KEYS.leaderboardTickets);
      removeKey(KEYS.leaderboardPrizes);
      set({
        snapshot: null,
        activeProof: null,
        latestImpact: null,
        localWeeklyResult: null,
        dailyResults: {},
        tickets: [],
        consumedTicketIds: [],
        pendingSubmissions: [],
        weeklyPrizes: [],
        viewState: 'idle',
        lastError: null,
      });
    },
  }));

  return store;
}

export const useLeaderboardStore = createLeaderboardStore();
