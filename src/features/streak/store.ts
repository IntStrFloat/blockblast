import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

import { bumpStreakWithProtector, isStreakAlive, todayISO } from './logic';
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
  protectorLastUsedDay: saved?.protectorLastUsedDay ?? null,
  markPlayedToday: () => {
    const { lastDay, count, protectorLastUsedDay } = get();
    const next = bumpStreakWithProtector({ lastDay, count, protectorLastUsedDay }, todayISO());
    set(next);
    setJSON(KEYS.streak, next);
  },
  visibleCount: () => {
    const { lastDay, count } = get();
    return isStreakAlive({ lastDay, count }, todayISO()) ? count : 0;
  },
}));
