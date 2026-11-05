// Metro folds __DEV__ and public env values into the bundle. Debug and isolated
// release QA always use demo units, even when .env.local supplies production IDs.
const useDemoAds = __DEV__ || process.env.EXPO_PUBLIC_YANDEX_TEST_ADS === 'true';

export const MONETIZATION = {
  /** Interstitial + rewarded через Yandex Mobile Ads */
  adsEnabled: true,
  /** Sticky-баннер под треем фигур */
  bannerEnabled: true,
  /** Покупки RuStore (remove_ads) */
  iapEnabled: false,
  yandex: {
    // Home has no banner placement. Do not invent a fourth block for the new app.
    homeBannerAdUnitId: '',
    bannerAdUnitId: useDemoAds
      ? 'demo-banner-yandex'
      : process.env.EXPO_PUBLIC_YANDEX_BANNER_AD_UNIT_ID ?? 'R-M-20255841-1',
    rewardedAdUnitId: useDemoAds
      ? 'demo-rewarded-yandex'
      : process.env.EXPO_PUBLIC_YANDEX_REWARDED_AD_UNIT_ID ?? 'R-M-20255841-2',
    interstitialAdUnitId: useDemoAds
      ? 'demo-interstitial-yandex'
      : process.env.EXPO_PUBLIC_YANDEX_INTERSTITIAL_AD_UNIT_ID ?? 'R-M-20255841-3',
  },
  interstitial: {
    /** Первую межстраничку держим до 6-й партии: доход с D0-новичка копеечный,
     *  а фуллскрин в первой сессии стоит заметной доли D1 (retention > ARPDAU здесь). */
    minGamesBeforeFirst: 6,
    /** Общая пауза после любого fullscreen, включая добровольную награду. */
    minIntervalSec: 180,
    /** Не чаще одной межстранички за четыре завершения. */
    everyNGameovers: 4,
  },
  interstitialExperiment: {
    id: 'interstitial-first-session-v1',
    /** Compile-time kill switch: false returns every install to current control policy. */
    enabled: process.env.EXPO_PUBLIC_INTERSTITIAL_EXPERIMENT_ENABLED !== 'false',
    variants: ['control', 'first_session_capped'] as const,
    treatmentMaxShowsPerSession: 2,
  },
  placementPolicy: {
    version: 'contextual-breaks-v3-decline-without-cooldown',
    // Initial testable product threshold, not a claim of an optimal eCPM.
    classicMinActiveMs: 120_000,
  },
  fakeRewardedInDev: false,
} as const;

export const PRODUCT_IDS = {
  removeAds: 'remove_ads',
} as const;
