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
    /** Первый показ на третьем проигрыше */
    minGamesBeforeFirst: 3,
    /** Частота определяется проигрышами, без дополнительного таймера */
    minIntervalSec: 0,
    /** Затем показ на каждый третий game over */
    everyNGameovers: 3,
  },
  fakeRewardedInDev: false,
} as const;

export const PRODUCT_IDS = {
  removeAds: 'remove_ads',
} as const;
