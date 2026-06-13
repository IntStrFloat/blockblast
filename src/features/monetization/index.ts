import { KEYS, getJSON, setJSON } from '@/core/storage';

import { MONETIZATION } from './config';
import { EMPTY_ADS_META } from './frequency';
import type { AdsMeta } from './frequency';
import { NoopAdsProvider, NoopIapProvider } from './noop';
import type { AdsProvider, IapProvider } from './types';
import { YandexAdsProvider } from './yandexAds';

export { MONETIZATION, PRODUCT_IDS } from './config';
export { AdBanner } from './AdBanner';
export { useEntitlements } from './entitlements';
export {
  EMPTY_ADS_META,
  recordGameOver,
  recordInterstitialShown,
  shouldShowInterstitial,
} from './frequency';
export type { AdsMeta } from './frequency';
export type {
  AdsProvider,
  IapProvider,
  InterstitialResult,
  Product,
  PurchaseResult,
  RewardedResult,
} from './types';

export function getAds(): AdsProvider {
  return MONETIZATION.adsEnabled ? YandexAdsProvider : NoopAdsProvider;
}

export function getIap(): IapProvider {
  if (MONETIZATION.iapEnabled) {
    // Здесь будет RuStoreIapProvider после регистрации в RuStore Console.
  }
  return NoopIapProvider;
}

/** Персист счётчиков частоты показов (KEYS.adsMeta). */
export function loadAdsMeta(): AdsMeta {
  return getJSON<AdsMeta>(KEYS.adsMeta) ?? EMPTY_ADS_META;
}

export function saveAdsMeta(meta: AdsMeta): void {
  setJSON(KEYS.adsMeta, meta);
}
