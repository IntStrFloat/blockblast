import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

interface ConsentState {
  accepted: boolean;
  accept: () => void;
}

const saved = getJSON<{ accepted?: boolean }>(KEYS.onboardingConsent);

export const useConsentStore = create<ConsentState>((set) => ({
  accepted: saved?.accepted === true,
  accept: () => {
    set({ accepted: true });
    setJSON(KEYS.onboardingConsent, { accepted: true });
  },
}));
