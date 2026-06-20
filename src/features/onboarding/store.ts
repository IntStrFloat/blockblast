import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

interface OnboardingState {
  /** Видел ли игрок онбординг меты (уровни/миры/карта/дейли/Капи). */
  seen: boolean;
}

interface OnboardingStore extends OnboardingState {
  markSeen: () => void;
}

/** Показывать онбординг при первом заходе после обновления (флаг ещё не выставлен). */
export function shouldShowOnboarding(seen: boolean): boolean {
  return !seen;
}

const saved = getJSON<OnboardingState>(KEYS.onboardingMeta);

export const useOnboarding = create<OnboardingStore>((set) => ({
  seen: saved?.seen ?? false,
  markSeen: () => {
    set({ seen: true });
    setJSON(KEYS.onboardingMeta, { seen: true });
  },
}));
