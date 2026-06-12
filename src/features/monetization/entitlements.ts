import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

interface EntitlementsState {
  removeAds: boolean;
  setRemoveAds: (value: boolean) => void;
}

const saved = getJSON<{ removeAds?: boolean }>(KEYS.entitlements);

export const useEntitlements = create<EntitlementsState>((set) => ({
  removeAds: saved?.removeAds ?? false,
  setRemoveAds: (value) => {
    set({ removeAds: value });
    setJSON(KEYS.entitlements, { removeAds: value });
  },
}));
