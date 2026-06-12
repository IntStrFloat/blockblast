/**
 * Флаги монетизации (спека 05).
 * Реальные SDK включаются здесь, когда появятся креды Yandex Ads / RuStore Console —
 * код экранов при этом не меняется.
 */
export const MONETIZATION = {
  /** Interstitial + rewarded через Yandex Mobile Ads */
  adsEnabled: false,
  /** Баннер на игровом экране — отдельное решение после метрик */
  bannerEnabled: false,
  /** Покупки RuStore (remove_ads) */
  iapEnabled: false,
  interstitial: {
    /** Не показывать рекламу первые N партий */
    minGamesBeforeFirst: 3,
    /** Минимум секунд между interstitial */
    minIntervalSec: 120,
    /** Показ на каждый N-й game over */
    everyNGameovers: 2,
  },
  /** В dev-сборках rewarded всегда «успешен» — для теста revive-флоу */
  fakeRewardedInDev: true,
} as const;

export const PRODUCT_IDS = {
  removeAds: 'remove_ads',
} as const;
