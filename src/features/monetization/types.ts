export interface Product {
  id: string;
  title: string;
  price: string;
}

export type InterstitialPlacement = 'gameover' | 'adventure_fail' | 'adventure_level';
export type RewardedPlacement = 'revive' | 'helper_charge' | 'adventure_xp_bonus';

export interface InterstitialTelemetry {
  policy_version?: string;
  result_context_id?: string;
  experiment_id: string;
  variant: 'control' | 'first_session_capped';
  mode: 'classic' | 'adventure';
  product_session_id: string;
  session_index: number;
  session_depth: number;
  active_play_ms: number;
  session_interstitial_shows: number;
}

export type InterstitialResult = 'shown' | 'skipped' | 'unavailable';
export type RewardedResult = 'rewarded' | 'dismissed' | 'unavailable';
export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

/** Реализации: NoopAdsProvider (v1), YandexAdsProvider (по флагу, спека 05). */
export interface AdsProvider {
  init(): Promise<void>;
  prepareInterstitial?(): Promise<void>;
  prepareRewarded?(): Promise<void>;
  subscribeRewardedReady?(listener: () => void): () => void;
  showInterstitial(
    placement: InterstitialPlacement,
    telemetry?: InterstitialTelemetry,
    onImpression?: () => void,
  ): Promise<InterstitialResult>;
  showRewarded(placement: RewardedPlacement, onEarned?: () => void): Promise<RewardedResult>;
  isRewardedReady(): boolean;
}

/** Реализации: NoopIapProvider (v1), RuStoreIapProvider / AppleIapProvider (по флагу). */
export interface IapProvider {
  init(): Promise<void>;
  getProducts(ids: string[]): Promise<Product[]>;
  purchase(id: string): Promise<PurchaseResult>;
  restore(): Promise<string[]>;
}
