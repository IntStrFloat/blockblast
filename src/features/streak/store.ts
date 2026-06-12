import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

import { bumpStreak, isStreakAlive, todayISO } from './logic';
import type { StreakState } from './logic';

interface StreakStore extends StreakState {
  /** Вызывается после каждой завершённой партии. */
  markPlayedToday: () => void;
  /** Видимое значение: 0, если стрик уже потерян. */
  visibleCount: () => number;
}

const saved = getJSON<StreakState>(KEYS.streak);

export const useStreak = create<StreakStore>((set, get) => ({
  lastDay: saved?.lastDay ?? null,
  count: saved?.count ?? 0,
  markPlayedToday: () => {
    const { lastDay, count } = get();
    const next = bumpStreak({ lastDay, count }, todayISO());
    set(next);
    setJSON(KEYS.streak, next);
  },
  visibleCount: () => {
    const { lastDay, count } = get();
    return isStreakAlive({ lastDay, count }, todayISO()) ? count : 0;
  },
}));
