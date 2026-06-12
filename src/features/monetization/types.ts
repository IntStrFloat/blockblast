export interface Product {
  id: string;
  title: string;
  price: string;
}

export type InterstitialPlacement = 'gameover';
export type RewardedPlacement = 'revive';

export type InterstitialResult = 'shown' | 'skipped' | 'unavailable';
export type RewardedResult = 'rewarded' | 'dismissed' | 'unavailable';
export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

/** Реализации: NoopAdsProvider (v1), YandexAdsProvider (по флагу, спека 05). */
export interface AdsProvider {
  init(): Promise<void>;
  showInterstitial(placement: InterstitialPlacement): Promise<InterstitialResult>;
  showRewarded(placement: RewardedPlacement): Promise<RewardedResult>;
  isRewardedReady(): boolean;
}

/** Реализации: NoopIapProvider (v1), RuStoreIapProvider / AppleIapProvider (по флагу). */
export interface IapProvider {
  init(): Promise<void>;
  getProducts(ids: string[]): Promise<Product[]>;
  purchase(id: string): Promise<PurchaseResult>;
  restore(): Promise<string[]>;
}
