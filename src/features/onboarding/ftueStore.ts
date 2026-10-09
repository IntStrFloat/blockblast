import { create } from 'zustand';

import { KEYS, getJSON, getString, setJSON } from '@/core/storage';
import { assignExperimentVariant } from '@/features/analytics/experiments';

export const FTUE_VERSION = 4 as const;
export const FTUE_STORAGE_KEY = 'onboarding.ftue.v2';
export const FTUE_EXPERIMENT_ID = 'ftue-independent-clear-v1';
export const FTUE_METRIC_VERSION = 'independent-clear-v1';
export const FTUE_METRIC_MOVE_LIMIT = 10;

export type FtueVariant = 'control' | 'independent_clear';
export type FtueOutcome = 'guided_success' | 'assisted_clear' | 'independent_success';
export type FtueInvalidDropReason = 'occupied' | 'outside-board';

export type FtueStatus =
  | 'not_started'
  | 'grab_piece'
  | 'valid_drop'
  | 'clear_line'
  | 'guided_success'
  | 'independent_play'
  | 'complete'
  | 'skipped';

export interface FtueState {
  version: typeof FTUE_VERSION;
  status: FtueStatus;
  variant: FtueVariant;
  metricVersion: typeof FTUE_METRIC_VERSION;
  startedAt: number | null;
  placements: number;
  invalidDrops: number;
  completedAt: number | null;
  skipReason: string | null;
  runId: string | null;
  guidedClearAt: number | null;
  acceptedMovesAfterFixture: number;
  movesSinceLastClear: number;
  invalidDropsSinceLastClear: number;
  assistanceActive: boolean;
  assistanceUsedSinceLastClear: boolean;
  practicePromptVisible: boolean;
  metricWindowClosed: boolean;
  outcome: FtueOutcome | null;
}

export interface FtuePlacementInput {
  clearedLines: number;
  followedHighlight: boolean;
  preparedFixtureMove?: boolean;
  now?: number;
}

export interface FtuePlacementResult {
  phase: 'guided' | 'assisted' | 'independent';
  clearOutcome: FtueOutcome | null;
  acceptedMovesAfterFixture: number;
  metricWindowClosed: boolean;
}

interface FtueStore extends FtueState {
  start: (now?: number) => void;
  bindRun: (runId: string) => void;
  beginAttempt: (runId: string, variant?: FtueVariant, now?: number) => void;
  restoreCheckpoint: (checkpoint: unknown, runId: string) => void;
  recordGrab: () => void;
  recordAcceptedPlacement: (input: FtuePlacementInput) => FtuePlacementResult;
  recordInvalidDrop: (reason?: FtueInvalidDropReason) => void;
  finishGuidedCelebration: (now?: number) => void;
  skip: (reason?: string, now?: number) => void;
}

interface MigrationInput {
  persisted: unknown;
  legacyTutorialDone: boolean;
  gamesPlayed: number;
  now?: number;
}

const TERMINAL_STATUSES: ReadonlySet<FtueStatus> = new Set(['complete', 'skipped']);
const VALID_STATUSES: ReadonlySet<FtueStatus> = new Set([
  'not_started',
  'grab_piece',
  'valid_drop',
  'clear_line',
  'guided_success',
  'independent_play',
  'complete',
  'skipped',
]);

function experimentOverride(): FtueVariant | null {
  const value = process.env.EXPO_PUBLIC_FTUE_VARIANT;
  return value === 'control' || value === 'independent_clear' ? value : null;
}

export function resolveFtueVariant(): FtueVariant {
  return (
    experimentOverride() ??
    (assignExperimentVariant(FTUE_EXPERIMENT_ID, [
      'control',
      'independent_clear',
    ]) as FtueVariant)
  );
}

function freshState(variant: FtueVariant = 'control'): FtueState {
  return {
    version: FTUE_VERSION,
    status: 'not_started',
    variant,
    metricVersion: FTUE_METRIC_VERSION,
    startedAt: null,
    placements: 0,
    invalidDrops: 0,
    completedAt: null,
    skipReason: null,
    runId: null,
    guidedClearAt: null,
    acceptedMovesAfterFixture: 0,
    movesSinceLastClear: 0,
    invalidDropsSinceLastClear: 0,
    assistanceActive: false,
    assistanceUsedSinceLastClear: false,
    practicePromptVisible: false,
    metricWindowClosed: false,
    outcome: null,
  };
}

function completedMigration(now: number): FtueState {
  return { ...freshState(), status: 'complete', completedAt: now, metricWindowClosed: true };
}

function normalizePersisted(candidate: Record<string, unknown>, now: number): FtueState | null {
  const rawStatus = candidate.status;
  const migratedStatus = rawStatus === 'celebrating' ? 'guided_success' : rawStatus;
  if (!VALID_STATUSES.has(migratedStatus as FtueStatus)) return null;
  const variant: FtueVariant =
    candidate.variant === 'independent_clear' ? 'independent_clear' : 'control';
  const status = migratedStatus as FtueStatus;
  const isLegacyTerminal =
    Number(candidate.version) < FTUE_VERSION && (status === 'complete' || status === 'skipped');
  return {
    ...freshState(variant),
    status,
    startedAt: typeof candidate.startedAt === 'number' ? candidate.startedAt : null,
    placements: Math.max(0, Math.trunc(Number(candidate.placements) || 0)),
    invalidDrops: Math.max(0, Math.trunc(Number(candidate.invalidDrops) || 0)),
    completedAt: typeof candidate.completedAt === 'number' ? candidate.completedAt : null,
    skipReason: typeof candidate.skipReason === 'string' ? candidate.skipReason : null,
    runId: typeof candidate.runId === 'string' ? candidate.runId : null,
    guidedClearAt:
      typeof candidate.guidedClearAt === 'number'
        ? candidate.guidedClearAt
        : status === 'guided_success'
          ? now
          : null,
    acceptedMovesAfterFixture: Math.max(
      0,
      Math.trunc(Number(candidate.acceptedMovesAfterFixture) || 0),
    ),
    movesSinceLastClear: Math.max(0, Math.trunc(Number(candidate.movesSinceLastClear) || 0)),
    invalidDropsSinceLastClear: Math.max(
      0,
      Math.trunc(Number(candidate.invalidDropsSinceLastClear) || 0),
    ),
    assistanceActive: candidate.assistanceActive === true,
    assistanceUsedSinceLastClear: candidate.assistanceUsedSinceLastClear === true,
    practicePromptVisible: candidate.practicePromptVisible === true,
    metricWindowClosed: candidate.metricWindowClosed === true || isLegacyTerminal,
    outcome:
      candidate.outcome === 'guided_success' ||
      candidate.outcome === 'assisted_clear' ||
      candidate.outcome === 'independent_success'
        ? candidate.outcome
        : status === 'guided_success'
          ? 'guided_success'
          : null,
  };
}

/** Pure migration boundary, kept exported so install/upgrade cases stay regression-tested. */
export function migrateFtueState({
  persisted,
  legacyTutorialDone,
  gamesPlayed,
  now = Date.now(),
}: MigrationInput): FtueState {
  if (persisted && typeof persisted === 'object') {
    const candidate = persisted as Record<string, unknown>;
    if ([2, 3, FTUE_VERSION].includes(Number(candidate.version))) {
      const normalized = normalizePersisted(candidate, now);
      if (normalized) return normalized;
    }
  }
  if (legacyTutorialDone || gamesPlayed > 0) return completedMigration(now);
  return freshState();
}

export function shouldEnterFtue(state: FtueState, gamesPlayed: number): boolean {
  return gamesPlayed === 0 && !TERMINAL_STATUSES.has(state.status);
}

export function isInitialFtueGuidance(state: FtueState): boolean {
  return state.guidedClearAt === null && !TERMINAL_STATUSES.has(state.status);
}

export function shouldShowFtueAssistance(state: FtueState): boolean {
  return (
    isInitialFtueGuidance(state) ||
    (state.variant === 'independent_clear' &&
      state.status === 'independent_play' &&
      state.assistanceActive &&
      !state.metricWindowClosed)
  );
}

export function ftueCheckpointForRun(runId: string): FtueState | null {
  const state = useFtueStore.getState();
  if (state.runId !== runId) return null;
  const {
    start: _start,
    bindRun: _bindRun,
    beginAttempt: _beginAttempt,
    restoreCheckpoint: _restoreCheckpoint,
    recordGrab: _recordGrab,
    recordAcceptedPlacement: _recordAcceptedPlacement,
    recordInvalidDrop: _recordInvalidDrop,
    finishGuidedCelebration: _finishGuidedCelebration,
    skip: _skip,
    ...checkpoint
  } = state;
  return checkpoint;
}

function persist(state: FtueState): void {
  setJSON(FTUE_STORAGE_KEY, state);
}

const storedScores = getJSON<{ gamesPlayed?: number }>(KEYS.scoresStats);
const initialState = migrateFtueState({
  persisted: getJSON<unknown>(FTUE_STORAGE_KEY),
  legacyTutorialDone: getString(KEYS.tutorialDone) === '1',
  gamesPlayed: storedScores?.gamesPlayed ?? 0,
});

function commit(set: (partial: Partial<FtueStore>) => void, next: FtueState): void {
  set(next);
  persist(next);
}

export const useFtueStore = create<FtueStore>((set, get) => ({
  ...initialState,
  start: (now = Date.now()) => {
    const state = get();
    if (state.status !== 'not_started') return;
    commit(set, { ...state, status: 'grab_piece', startedAt: state.startedAt ?? now });
  },
  bindRun: (runId) => {
    const state = get();
    if (TERMINAL_STATUSES.has(state.status) || state.runId === runId) return;
    commit(set, { ...state, runId });
  },
  beginAttempt: (runId, variant = resolveFtueVariant(), now = Date.now()) => {
    commit(set, { ...freshState(variant), status: 'grab_piece', startedAt: now, runId });
  },
  restoreCheckpoint: (checkpoint, runId) => {
    if (!checkpoint || typeof checkpoint !== 'object') {
      const state = get();
      if (!TERMINAL_STATUSES.has(state.status) && state.runId !== runId) {
        commit(set, { ...state, runId });
      }
      return;
    }
    const restored = normalizePersisted(checkpoint as Record<string, unknown>, Date.now());
    if (!restored || restored.runId !== runId) return;
    commit(set, restored);
  },
  recordGrab: () => {
    const state = get();
    if (state.status === 'grab_piece') commit(set, { ...state, status: 'valid_drop' });
  },
  recordAcceptedPlacement: ({
    clearedLines,
    followedHighlight,
    preparedFixtureMove = false,
    now = Date.now(),
  }) => {
    let state = get();
    const cleared = clearedLines > 0;
    if (state.status === 'skipped' && state.guidedClearAt === null && !preparedFixtureMove) {
      state = {
        ...state,
        guidedClearAt: state.completedAt ?? now,
        outcome: state.outcome ?? 'guided_success',
      };
    }
    if (
      state.guidedClearAt === null &&
      (!TERMINAL_STATUSES.has(state.status) || state.status === 'skipped')
    ) {
      const next: FtueState = {
        ...state,
        placements: state.placements + 1,
        status:
          state.status === 'skipped' ? 'skipped' : cleared ? 'guided_success' : 'clear_line',
        guidedClearAt: cleared ? now : null,
        outcome: cleared ? 'guided_success' : state.outcome,
        movesSinceLastClear: cleared ? 0 : state.movesSinceLastClear + 1,
        invalidDropsSinceLastClear: cleared ? 0 : state.invalidDropsSinceLastClear,
        assistanceActive: !cleared,
        assistanceUsedSinceLastClear: false,
      };
      commit(set, next);
      return {
        phase: 'guided',
        clearOutcome: cleared ? 'guided_success' : null,
        acceptedMovesAfterFixture: 0,
        metricWindowClosed: false,
      };
    }
    if (state.guidedClearAt === null || state.metricWindowClosed) {
      return {
        phase: 'independent',
        clearOutcome: null,
        acceptedMovesAfterFixture: state.acceptedMovesAfterFixture,
        metricWindowClosed: state.metricWindowClosed,
      };
    }
    const acceptedMovesAfterFixture = state.acceptedMovesAfterFixture + 1;
    const assistedClear =
      cleared && (state.assistanceUsedSinceLastClear || followedHighlight);
    const phase = followedHighlight || assistedClear ? 'assisted' : 'independent';
    const clearOutcome: FtueOutcome | null = cleared
      ? assistedClear
        ? 'assisted_clear'
        : 'independent_success'
      : null;
    const metricWindowClosed =
      clearOutcome === 'independent_success' || acceptedMovesAfterFixture >= FTUE_METRIC_MOVE_LIMIT;
    const terminalStatus =
      state.status === 'skipped'
        ? 'skipped'
        : clearOutcome === 'independent_success' ||
            (state.variant === 'independent_clear' && metricWindowClosed)
          ? 'complete'
          : state.status;
    const movesSinceLastClear = cleared ? 0 : state.movesSinceLastClear + 1;
    const assistanceActive =
      state.variant === 'independent_clear' &&
      terminalStatus === 'independent_play' &&
      !metricWindowClosed &&
      !cleared &&
      (state.assistanceActive || movesSinceLastClear >= 2);
    const next: FtueState = {
      ...state,
      placements: state.placements + 1,
      status: terminalStatus,
      completedAt:
        terminalStatus === 'complete' || terminalStatus === 'skipped'
          ? state.completedAt ?? now
          : state.completedAt,
      acceptedMovesAfterFixture,
      movesSinceLastClear,
      invalidDropsSinceLastClear: cleared ? 0 : state.invalidDropsSinceLastClear,
      assistanceActive,
      assistanceUsedSinceLastClear: cleared
        ? false
        : state.assistanceUsedSinceLastClear || followedHighlight,
      practicePromptVisible: false,
      metricWindowClosed,
      outcome: clearOutcome ?? state.outcome,
    };
    commit(set, next);
    return { phase, clearOutcome, acceptedMovesAfterFixture, metricWindowClosed };
  },
  recordInvalidDrop: (reason = 'occupied') => {
    if (reason === 'outside-board') return;
    const state = get();
    const invalidDropsSinceLastClear = state.invalidDropsSinceLastClear + 1;
    commit(set, {
      ...state,
      invalidDrops: state.invalidDrops + 1,
      invalidDropsSinceLastClear,
      assistanceActive:
        state.assistanceActive ||
        (state.variant === 'independent_clear' &&
          state.status === 'independent_play' &&
          invalidDropsSinceLastClear >= 2),
    });
  },
  finishGuidedCelebration: (now = Date.now()) => {
    const state = get();
    if (state.status !== 'guided_success') return;
    commit(
      set,
      state.variant === 'control'
        ? { ...state, status: 'complete', completedAt: now, outcome: 'guided_success' }
        : {
            ...state,
            status: 'independent_play',
            practicePromptVisible: true,
            assistanceActive: false,
          },
    );
  },
  skip: (reason = 'user', now = Date.now()) => {
    const state = get();
    if (state.status === 'complete' || state.status === 'skipped') return;
    commit(set, {
      ...state,
      status: 'skipped',
      startedAt: state.startedAt ?? now,
      completedAt: now,
      skipReason: reason,
      assistanceActive: false,
      practicePromptVisible: false,
    });
  },
}));
