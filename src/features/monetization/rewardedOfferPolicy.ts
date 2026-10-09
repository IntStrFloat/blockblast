import { getJSON, KEYS, setJSON } from '@/core/storage';

import { suppressAutomaticAds } from './adPresentation';
import { EMPTY_ADS_META, type AdsMeta } from './frequency';

export function rememberRewardedOffer(resultContextId: string): void {
  const meta = getJSON<AdsMeta>(KEYS.adsMeta) ?? EMPTY_ADS_META;
  if (meta.rewardedOfferContextId === resultContextId) return;
  setJSON(KEYS.adsMeta, { ...meta, rewardedOfferContextId: resultContextId });
}

/** Choosing normal play is also a valid decline, never an interstitial trigger. */
export function leaveRewardedOffer(resultContextId: string): boolean {
  const meta = getJSON<AdsMeta>(KEYS.adsMeta);
  if (meta?.rewardedOfferContextId !== resultContextId) return false;
  suppressAutomaticAds();
  return true;
}
