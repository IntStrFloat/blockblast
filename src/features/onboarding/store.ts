import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

interface OnboardingState {
  /** Видел ли игрок онбординг меты (уровни/миры/карта/дейли/Капи). */
  seen: boolean;
}

interface OnboardingStore extends OnboardingState {
  markSeen: () => void;
}

/**
 * Показывать мета-онбординг: флаг ещё не выставлен И игрок сыграл ≥1 партию.
 * Новичок (0 партий) идёт прямо в игру — мета-лекция появится после первой партии,
 * когда системам (уровень/миры/дейли) уже есть контекст (FTUE, спека 10).
 */
export function shouldShowOnboarding(seen: boolean, gamesPlayed: number): boolean {
  return !seen && gamesPlayed >= 1;
}

const saved = getJSON<OnboardingState>(KEYS.onboardingMeta);

export const useOnboarding = create<OnboardingStore>((set) => ({
  seen: saved?.seen ?? false,
  markSeen: () => {
    set({ seen: true });
    setJSON(KEYS.onboardingMeta, { seen: true });
  },
}));
