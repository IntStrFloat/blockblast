import { getJSON, KEYS, setJSON } from '@/core/storage';

import { EMPTY_ADS_META, type AdsMeta } from './frequency';

export function rememberRewardedOffer(resultContextId: string): void {
  const meta = getJSON<AdsMeta>(KEYS.adsMeta) ?? EMPTY_ADS_META;
  if (meta.rewardedOfferContextId === resultContextId) return;
  setJSON(KEYS.adsMeta, { ...meta, rewardedOfferContextId: resultContextId });
}

/** A declined offer is not a fullscreen impression and must not start a cooldown. */
export function leaveRewardedOffer(resultContextId: string): boolean {
  const meta = getJSON<AdsMeta>(KEYS.adsMeta);
  if (meta?.rewardedOfferContextId !== resultContextId) return false;
  setJSON(KEYS.adsMeta, { ...meta, rewardedOfferContextId: null });
  return true;
}
