export const MONETIZATION = {
  /** Interstitial + rewarded через Yandex Mobile Ads */
  adsEnabled: true,
  /** Sticky-баннер под треем фигур */
  bannerEnabled: true,
  /** Покупки RuStore (remove_ads) */
  iapEnabled: false,
  yandex: {
    // Demo units keep local/repository builds testable. Store builds must inject
    // active production units through EXPO_PUBLIC_YANDEX_*_AD_UNIT_ID.
    homeBannerAdUnitId:
      process.env.EXPO_PUBLIC_YANDEX_HOME_BANNER_AD_UNIT_ID ?? 'R-M-19446153-4',
    bannerAdUnitId:
      process.env.EXPO_PUBLIC_YANDEX_BANNER_AD_UNIT_ID ?? 'demo-banner-yandex',
    rewardedAdUnitId:
      process.env.EXPO_PUBLIC_YANDEX_REWARDED_AD_UNIT_ID ?? 'demo-rewarded-yandex',
    interstitialAdUnitId:
      process.env.EXPO_PUBLIC_YANDEX_INTERSTITIAL_AD_UNIT_ID ?? 'demo-interstitial-yandex',
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
    version: 'contextual-breaks-v2-four-rounds',
    // Initial testable product threshold, not a claim of an optimal eCPM.
    classicMinActiveMs: 120_000,
  },
  fakeRewardedInDev: false,
} as const;

export const PRODUCT_IDS = {
  removeAds: 'remove_ads',
} as const;
