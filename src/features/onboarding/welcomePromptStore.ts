import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

interface WelcomePromptState {
  resolved: boolean;
  resolve: () => void;
}

const saved = getJSON<{ resolved?: boolean }>(KEYS.onboardingWelcomePrompt);

/** Persists the first-run notification prompt decision before FTUE begins. */
export const useWelcomePromptStore = create<WelcomePromptState>((set) => ({
  resolved: saved?.resolved === true,
  resolve: () => {
    set({ resolved: true });
    setJSON(KEYS.onboardingWelcomePrompt, { resolved: true });
  },
}));
