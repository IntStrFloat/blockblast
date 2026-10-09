import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

interface ScoresData {
  best: number;
  gamesPlayed: number;
  totalLinesCleared: number;
  settledRuns: Record<string, SettledRunReceipt | SubmitResult>;
}

export interface SubmitResult {
  newRecord: boolean;
  /** На сколько побит прошлый рекорд (0, если не побит) */
  delta: number;
}

export interface SettledRunReceipt {
  score: number;
  linesCleared: number;
  result: SubmitResult;
}

interface ScoresState extends ScoresData {
  submitGame: (score: number, linesCleared: number) => SubmitResult;
  submitGameOnce: (
    runId: string,
    score: number,
    linesCleared: number,
  ) => SubmitResult & { applied: boolean };
  submitGameRevision: (
    runId: string,
    score: number,
    linesCleared: number,
  ) => SubmitResult & { applied: boolean };
  improveBest: (score: number) => SubmitResult;
  resetBest: () => void;
}

const DEFAULTS: ScoresData = {
  best: 0,
  gamesPlayed: 0,
  totalLinesCleared: 0,
  settledRuns: {},
};

const saved = getJSON<Partial<ScoresData>>(KEYS.scoresStats);

function persist(s: ScoresData): void {
  setJSON(KEYS.scoresStats, {
    best: s.best,
    gamesPlayed: s.gamesPlayed,
    totalLinesCleared: s.totalLinesCleared,
    settledRuns: s.settledRuns,
  });
}

export const useScores = create<ScoresState>((set, get) => ({
  ...DEFAULTS,
  ...saved,
  submitGame: (score, linesCleared) => {
    const prev = get();
    const newRecord = score > prev.best;
    const next: ScoresData = {
      best: Math.max(prev.best, score),
      gamesPlayed: prev.gamesPlayed + 1,
      totalLinesCleared: prev.totalLinesCleared + linesCleared,
      settledRuns: prev.settledRuns,
    };
    set(next);
    persist(next);
    return { newRecord, delta: newRecord ? score - prev.best : 0 };
  },
  submitGameOnce: (runId, score, linesCleared) => {
    const existing = get().settledRuns[runId];
    if (existing) {
      return {
        ...('result' in existing ? existing.result : existing),
        applied: false,
      };
    }
    return get().submitGameRevision(runId, score, linesCleared);
  },
  submitGameRevision: (runId, score, linesCleared) => {
    const prev = get();
    const existing = prev.settledRuns[runId];
    // A pre-receipt record cannot prove its historical score. Conservatively
    // lock it instead of replaying old statistics after migration.
    if (existing && !('score' in existing)) return { ...existing, applied: false };
    const previousScore = existing?.score ?? 0;
    const previousLines = existing?.linesCleared ?? 0;
    const targetScore = Math.max(0, Math.floor(score));
    const targetLines = Math.max(0, Math.floor(linesCleared));
    if (existing && targetScore <= previousScore && targetLines <= previousLines) {
      return { ...existing.result, applied: false };
    }
    const result: SubmitResult = {
      newRecord: targetScore > prev.best,
      delta: targetScore > prev.best ? targetScore - prev.best : 0,
    };
    const next: ScoresData = {
      best: Math.max(prev.best, targetScore),
      gamesPlayed: prev.gamesPlayed + (existing ? 0 : 1),
      totalLinesCleared:
        prev.totalLinesCleared + Math.max(0, targetLines - previousLines),
      settledRuns: {
        ...prev.settledRuns,
        [runId]: {
          score: Math.max(previousScore, targetScore),
          linesCleared: Math.max(previousLines, targetLines),
          result,
        },
      },
    };
    persist(next);
    set(next);
    return { ...result, applied: true };
  },
  improveBest: (score) => {
    const prev = get();
    const newRecord = score > prev.best;
    if (!newRecord) return { newRecord: false, delta: 0 };

    const next: ScoresData = {
      best: score,
      gamesPlayed: prev.gamesPlayed,
      totalLinesCleared: prev.totalLinesCleared,
      settledRuns: prev.settledRuns,
    };
    set(next);
    persist(next);
    return { newRecord: true, delta: score - prev.best };
  },
  resetBest: () => {
    set({ best: 0 });
    const { best, gamesPlayed, totalLinesCleared, settledRuns } = get();
    persist({ best, gamesPlayed, totalLinesCleared, settledRuns });
  },
}));
