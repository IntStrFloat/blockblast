import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

interface ScoresData {
  best: number;
  gamesPlayed: number;
  totalLinesCleared: number;
}

export interface SubmitResult {
  newRecord: boolean;
  /** На сколько побит прошлый рекорд (0, если не побит) */
  delta: number;
}

interface ScoresState extends ScoresData {
  submitGame: (score: number, linesCleared: number) => SubmitResult;
  resetBest: () => void;
}

const DEFAULTS: ScoresData = { best: 0, gamesPlayed: 0, totalLinesCleared: 0 };

const saved = getJSON<Partial<ScoresData>>(KEYS.scoresStats);

function persist(s: ScoresData): void {
  setJSON(KEYS.scoresStats, {
    best: s.best,
    gamesPlayed: s.gamesPlayed,
    totalLinesCleared: s.totalLinesCleared,
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
    };
    set(next);
    persist(next);
    return { newRecord, delta: newRecord ? score - prev.best : 0 };
  },
  resetBest: () => {
    set({ best: 0 });
    const { best, gamesPlayed, totalLinesCleared } = get();
    persist({ best, gamesPlayed, totalLinesCleared });
  },
}));
