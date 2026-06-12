import { MONETIZATION } from './config';
import { NoopAdsProvider, NoopIapProvider } from './noop';
import type { AdsProvider, IapProvider } from './types';

export { MONETIZATION, PRODUCT_IDS } from './config';
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

/**
 * Фабрики провайдеров. При включении флагов сюда добавляются
 * YandexAdsProvider / RuStoreIapProvider (шаги — спека 05), интерфейс не меняется.
 */
export function getAds(): AdsProvider {
  if (MONETIZATION.adsEnabled) {
    // Здесь будет YandexAdsProvider после появления ad unit IDs.
  }
  return NoopAdsProvider;
}

export function getIap(): IapProvider {
  if (MONETIZATION.iapEnabled) {
    // Здесь будет RuStoreIapProvider после регистрации в RuStore Console.
  }
  return NoopIapProvider;
}
