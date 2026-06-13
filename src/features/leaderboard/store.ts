import { create } from 'zustand';

import { KEYS, getJSON, getString, removeKey, setJSON } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';
import { createGeneratedProfile } from '@/features/profile/nickname';

import { createLeaderboardClient, type LeaderboardClient } from './client';
import { appendRunMove, beginRunProof, finalizeRunProof } from './runProof';
import type {
  LeaderboardViewState,
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

interface DailyResult {
  dateIso: string;
  bestScore: number;
}

interface LeaderboardState {
  snapshot: WeeklyLeaderboardSnapshot | null;
  activeProof: RunProof | null;
  latestImpact: WeeklyImpact | null;
  dailyResults: Record<string, DailyResult>;
  tickets: RankedTicket[];
  pendingSubmissions: PendingSubmission[];
  viewState: LeaderboardViewState;
  lastError: 'offline' | 'remote_error' | null;
  startRun: (input: {
    startedAt: string;
    mode: RunMode;
    seed?: number;
    challengeDate?: string | null;
  }) => RunProof;
  recordMove: (move: RunMove) => void;
  finishActiveRun: (score: number, now?: Date) => Promise<WeeklyImpact | null>;
  issueTickets: (authToken?: string | null) => Promise<RankedTicket[]>;
  flushPending: (authToken?: string | null) => Promise<void>;
  refresh: (now?: Date) => Promise<WeeklyLeaderboardSnapshot>;
  refreshIfStale: (now?: Date, staleMs?: number) => Promise<WeeklyLeaderboardSnapshot>;
  resetForTests: (profile?: ProfileIdentity) => void;
}

interface CreateLeaderboardStoreOptions {
  profile?: ProfileIdentity;
  client?: LeaderboardClient;
}

function persistState(state: Pick<LeaderboardState, 'activeProof' | 'snapshot' | 'dailyResults' | 'tickets' | 'pendingSubmissions'>) {
  setJSON(KEYS.leaderboardActiveProof, state.activeProof);
  setJSON(KEYS.leaderboardSnapshot, state.snapshot);
  setJSON(KEYS.leaderboardDaily, state.dailyResults);
  setJSON(KEYS.leaderboardTickets, state.tickets);
  setJSON(KEYS.leaderboardPending, state.pendingSubmissions);
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

function consumeNextTicket(tickets: RankedTicket[], startedAt: string) {
  const nextTicket = tickets.find((ticket) => new Date(ticket.expiresAt).getTime() > new Date(startedAt).getTime()) ?? null;
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
  const initialDaily = getJSON<Record<string, DailyResult>>(KEYS.leaderboardDaily) ?? {};
  const initialTickets = getJSON<RankedTicket[]>(KEYS.leaderboardTickets) ?? [];
  const initialPending = getJSON<PendingSubmission[]>(KEYS.leaderboardPending) ?? [];

  const store = create<LeaderboardState>((set, get) => ({
    snapshot: initialSnapshot,
    activeProof: initialActiveProof,
    latestImpact: null,
    dailyResults: initialDaily,
    tickets: initialTickets,
    pendingSubmissions: initialPending,
    viewState: initialSnapshot ? (initialSnapshot.isCached ? 'cached' : initialSnapshot.entries.length > 0 ? 'ready' : 'empty') : 'idle',
    lastError: null,

    startRun: (input) => {
      const startedAt = input.startedAt;
      const explicitSeed = input.seed ?? Math.floor(Date.now() % 2147483647);
      const ticketConsumption =
        input.mode === 'weekly'
          ? consumeNextTicket(get().tickets, startedAt)
          : { ticket: null, remaining: get().tickets };
      const proof = beginRunProof({
        seed: ticketConsumption.ticket?.seed ?? explicitSeed,
        startedAt,
        mode: input.mode,
        challengeDate: input.challengeDate ?? null,
        ticket: ticketConsumption.ticket,
      });
      set({ activeProof: proof, latestImpact: null, tickets: ticketConsumption.remaining });
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

      if (!finishedProof.ranked || !finishedProof.ticketId) {
        set({ latestImpact: null });
        persistState({ ...get(), activeProof: finishedProof });
        return null;
      }

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
        const merged = [...get().tickets, ...issuedTickets].filter(
          (ticket, index, list) => list.findIndex((candidate) => candidate.ticketId === ticket.ticketId) === index,
        );
        set({ tickets: merged });
        persistState({ ...get(), tickets: merged });
        return merged;
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
        } catch {
          remaining.push(submission);
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

    resetForTests: (profile = createGeneratedProfile(7)) => {
      setJSON(KEYS.profileLocal, profile);
      removeKey(KEYS.profileAuth);
      removeKey(KEYS.leaderboardActiveProof);
      removeKey(KEYS.leaderboardSnapshot);
      removeKey(KEYS.leaderboardDaily);
      removeKey(KEYS.leaderboardPending);
      removeKey(KEYS.leaderboardTickets);
      set({
        snapshot: null,
        activeProof: null,
        latestImpact: null,
        dailyResults: {},
        tickets: [],
        pendingSubmissions: [],
        viewState: 'idle',
        lastError: null,
      });
    },
  }));

  return store;
}

export const useLeaderboardStore = createLeaderboardStore();
