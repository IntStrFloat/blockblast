import { create } from 'zustand';

import { KEYS, getJSON, getString, setJSON } from '@/core/storage';

export const FTUE_VERSION = 2 as const;
export const FTUE_STORAGE_KEY = 'onboarding.ftue.v2';

export type FtueStatus =
  | 'not_started'
  | 'grab_piece'
  | 'valid_drop'
  | 'clear_line'
  | 'celebrating'
  | 'complete'
  | 'skipped';

export interface FtueState {
  version: typeof FTUE_VERSION;
  status: FtueStatus;
  startedAt: number | null;
  placements: number;
  invalidDrops: number;
  completedAt: number | null;
  skipReason: string | null;
}

interface FtueStore extends FtueState {
  start: (now?: number) => void;
  recordGrab: () => void;
  recordValidDrop: () => void;
  recordInvalidDrop: () => void;
  recordLineClear: () => void;
  completeAfterCelebration: (now?: number) => void;
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
  'celebrating',
  'complete',
  'skipped',
]);

function freshState(): FtueState {
  return {
    version: FTUE_VERSION,
    status: 'not_started',
    startedAt: null,
    placements: 0,
    invalidDrops: 0,
    completedAt: null,
    skipReason: null,
  };
}

function completedMigration(now: number): FtueState {
  return {
    ...freshState(),
    status: 'complete',
    completedAt: now,
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
    const candidate = persisted as Partial<FtueState>;
    if (candidate.version === FTUE_VERSION && VALID_STATUSES.has(candidate.status as FtueStatus)) {
      return {
        version: FTUE_VERSION,
        status: candidate.status as FtueStatus,
        startedAt: typeof candidate.startedAt === 'number' ? candidate.startedAt : null,
        placements: Math.max(0, Math.trunc(candidate.placements ?? 0)),
        invalidDrops: Math.max(0, Math.trunc(candidate.invalidDrops ?? 0)),
        completedAt: typeof candidate.completedAt === 'number' ? candidate.completedAt : null,
        skipReason: typeof candidate.skipReason === 'string' ? candidate.skipReason : null,
      };
    }
  }

  // The old dismissible tutorial and any real play both mean that this is not a new install.
  if (legacyTutorialDone || gamesPlayed > 0) return completedMigration(now);
  return freshState();
}

export function shouldEnterFtue(state: FtueState, gamesPlayed: number): boolean {
  return gamesPlayed === 0 && !TERMINAL_STATUSES.has(state.status);
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

function update(
  set: (partial: Partial<FtueStore>) => void,
  get: () => FtueStore,
  recipe: (state: FtueState) => FtueState,
): void {
  const current = get();
  if (TERMINAL_STATUSES.has(current.status)) return;
  const next = recipe(current);
  set(next);
  persist(next);
}

export const useFtueStore = create<FtueStore>((set, get) => ({
  ...initialState,
  start: (now = Date.now()) => {
    update(set, get, (state) =>
      state.status === 'not_started'
        ? { ...state, status: 'grab_piece', startedAt: state.startedAt ?? now }
        : state,
    );
  },
  recordGrab: () => {
    update(set, get, (state) =>
      state.status === 'grab_piece' ? { ...state, status: 'valid_drop' } : state,
    );
  },
  recordValidDrop: () => {
    update(set, get, (state) => ({
      ...state,
      placements: state.placements + 1,
      status:
        state.status === 'grab_piece' || state.status === 'valid_drop'
          ? 'clear_line'
          : state.status,
    }));
  },
  recordInvalidDrop: () => {
    update(set, get, (state) => ({ ...state, invalidDrops: state.invalidDrops + 1 }));
  },
  // Kept separate from completion: the game completes FTUE only after its clear celebration.
  recordLineClear: () => {
    update(set, get, (state) =>
      state.status === 'clear_line' ? { ...state, status: 'celebrating' } : state,
    );
  },
  completeAfterCelebration: (now = Date.now()) => {
    update(set, get, (state) =>
      state.status === 'celebrating'
        ? { ...state, status: 'complete', completedAt: now, skipReason: null }
        : state,
    );
  },
  skip: (reason = 'user', now = Date.now()) => {
    update(set, get, (state) => ({
      ...state,
      status: 'skipped',
      startedAt: state.startedAt ?? now,
      completedAt: now,
      skipReason: reason,
    }));
  },
}));
