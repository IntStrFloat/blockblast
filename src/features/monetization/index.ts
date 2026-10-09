import { KEYS, getJSON, setJSON, setJSONOrThrow } from '@/core/storage';

import { MONETIZATION } from './config';
import { EMPTY_ADS_META } from './frequency';
import type { AdsMeta } from './frequency';
import { NoopAdsProvider, NoopIapProvider } from './noop';
import type { AdsProvider, IapProvider } from './types';
import { YandexAdsProvider } from './yandexAds';

export { MONETIZATION, PRODUCT_IDS } from './config';
export { AdBanner } from './AdBanner';
export type { AdBannerProps } from './AdBanner';
export { GameBannerDock } from './game-banner-dock';
export { useEntitlements } from './entitlements';
export {
  getRewardedCtaPolicy,
  shouldShowGameBanner,
  shouldShowHomeBanner,
} from './policy';
export type {
  GameBannerEligibility,
  RewardedCtaInput,
  RewardedCtaPolicy,
} from './policy';
export {
  EMPTY_ADS_META,
  recordFullscreenCooldown,
  recordAdventureFail,
  recordAdventureLevelWin,
  recordGameOver,
  recordInterstitialShown,
  interstitialShowsForSession,
  shouldShowInterstitial,
} from './frequency';
export type { AdsMeta, FrequencyOpts, InterstitialCounter } from './frequency';
export {
  currentInterstitialExperimentVariant,
  evaluateInterstitialOpportunity,
  initializeInterstitialExperiment,
} from './interstitialExperiment';
export type {
  InterstitialExperimentVariant,
  InterstitialOpportunity,
  InterstitialPolicyDecision,
} from './interstitialExperiment';
export type {
  AdsProvider,
  IapProvider,
  InterstitialResult,
  InterstitialTelemetry,
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

export function saveAdsMeta(meta: AdsMeta, critical = false): void {
  if (critical) setJSONOrThrow(KEYS.adsMeta, meta);
  else setJSON(KEYS.adsMeta, meta);
}
