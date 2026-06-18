describe('monetization ad unit configuration', () => {
  const envKeys = [
    'EXPO_PUBLIC_YANDEX_HOME_BANNER_AD_UNIT_ID',
    'EXPO_PUBLIC_YANDEX_BANNER_AD_UNIT_ID',
    'EXPO_PUBLIC_YANDEX_REWARDED_AD_UNIT_ID',
    'EXPO_PUBLIC_YANDEX_INTERSTITIAL_AD_UNIT_ID',
  ] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    jest.resetModules();
  });

  it('uses official Yandex demo units when build-time production IDs are absent', () => {
    for (const key of envKeys) delete process.env[key];

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MONETIZATION } = require('../config') as typeof import('../config');

      expect(MONETIZATION.yandex).toEqual({
        homeBannerAdUnitId: 'R-M-19446153-4',
        bannerAdUnitId: 'demo-banner-yandex',
        rewardedAdUnitId: 'demo-rewarded-yandex',
        interstitialAdUnitId: 'demo-interstitial-yandex',
      });
    });
  });

  it('uses build-time Yandex production IDs when provided', () => {
    process.env.EXPO_PUBLIC_YANDEX_HOME_BANNER_AD_UNIT_ID = 'R-M-1-0';
    process.env.EXPO_PUBLIC_YANDEX_BANNER_AD_UNIT_ID = 'R-M-1-1';
    process.env.EXPO_PUBLIC_YANDEX_REWARDED_AD_UNIT_ID = 'R-M-1-2';
    process.env.EXPO_PUBLIC_YANDEX_INTERSTITIAL_AD_UNIT_ID = 'R-M-1-3';

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MONETIZATION } = require('../config') as typeof import('../config');

      expect(MONETIZATION.yandex).toEqual({
        homeBannerAdUnitId: 'R-M-1-0',
        bannerAdUnitId: 'R-M-1-1',
        rewardedAdUnitId: 'R-M-1-2',
        interstitialAdUnitId: 'R-M-1-3',
      });
    });
  });
});
