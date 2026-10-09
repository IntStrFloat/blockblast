import { create } from 'zustand';

import { getJSON, KEYS, setJSON } from '@/core/storage';

import { MONETIZATION } from './config';

const saved = getJSON<{ automaticAdsSuppressedUntil?: number }>(KEYS.adsPresentation);
const storedUntil = saved?.automaticAdsSuppressedUntil;

export const useAdPresentation = create<{
  fullscreenActive: boolean;
  automaticAdsSuppressedUntil: number;
}>(() => ({
  fullscreenActive: false,
  automaticAdsSuppressedUntil:
    typeof storedUntil === 'number' && Number.isFinite(storedUntil)
      ? Math.min(storedUntil, Date.now() + MONETIZATION.interstitial.minIntervalSec * 1_000)
      : 0,
}));

/** Business policy independent of analytics consent, also survives process death. */
export function suppressAutomaticAds(nowMs = Date.now()): void {
  const automaticAdsSuppressedUntil = nowMs + MONETIZATION.interstitial.minIntervalSec * 1_000;
  useAdPresentation.setState({ automaticAdsSuppressedUntil });
  setJSON(KEYS.adsPresentation, { automaticAdsSuppressedUntil });
}

export function areAutomaticAdsSuppressed(nowMs = Date.now()): boolean {
  return useAdPresentation.getState().automaticAdsSuppressedUntil > nowMs;
}
