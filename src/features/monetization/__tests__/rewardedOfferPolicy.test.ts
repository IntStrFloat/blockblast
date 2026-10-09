import { getJSON, KEYS, removeKey, setJSON } from '@/core/storage';

import { useAdPresentation } from '../adPresentation';
import { EMPTY_ADS_META, type AdsMeta } from '../frequency';
import { leaveRewardedOffer, rememberRewardedOffer } from '../rewardedOfferPolicy';

beforeEach(() => {
  removeKey(KEYS.adsMeta);
  useAdPresentation.setState({ automaticAdsSuppressedUntil: 0 });
});

it('persists the offered result and protects a normal continuation without faking an impression', () => {
  setJSON(KEYS.adsMeta, { ...EMPTY_ADS_META, gamesPlayed: 12 });
  rememberRewardedOffer('result-a');
  expect(getJSON<AdsMeta>(KEYS.adsMeta)).toMatchObject({ gamesPlayed: 12, rewardedOfferContextId: 'result-a' });
  expect(leaveRewardedOffer('unrelated')).toBe(false);
  expect(useAdPresentation.getState().automaticAdsSuppressedUntil).toBe(0);
  expect(leaveRewardedOffer('result-a')).toBe(true);
  expect(useAdPresentation.getState().automaticAdsSuppressedUntil).toBeGreaterThan(Date.now());
  expect(getJSON<AdsMeta>(KEYS.adsMeta)?.lastInterstitialAt).toBeNull();
  expect(getJSON<AdsMeta>(KEYS.adsMeta)?.lastFullscreenAt).toBeNull();
});
