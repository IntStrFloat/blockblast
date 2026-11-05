describe('monetization ad unit configuration', () => {
  const envKeys = [
    'EXPO_PUBLIC_YANDEX_HOME_BANNER_AD_UNIT_ID',
    'EXPO_PUBLIC_YANDEX_BANNER_AD_UNIT_ID',
    'EXPO_PUBLIC_YANDEX_REWARDED_AD_UNIT_ID',
    'EXPO_PUBLIC_YANDEX_INTERSTITIAL_AD_UNIT_ID',
    'EXPO_PUBLIC_YANDEX_TEST_ADS',
  ] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const originalDev = __DEV__;
  const demoUnits = {
    homeBannerAdUnitId: '',
    bannerAdUnitId: 'demo-banner-yandex',
    rewardedAdUnitId: 'demo-rewarded-yandex',
    interstitialAdUnitId: 'demo-interstitial-yandex',
  };
  const productionUnits = {
    homeBannerAdUnitId: '',
    bannerAdUnitId: 'R-M-20255841-1',
    rewardedAdUnitId: 'R-M-20255841-2',
    interstitialAdUnitId: 'R-M-20255841-3',
  };

  function readUnits() {
    let units;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MONETIZATION } = require('../config') as typeof import('../config');
      units = MONETIZATION.yandex;
    });
    return units;
  }

  function injectProductionEnv() {
    process.env.EXPO_PUBLIC_YANDEX_HOME_BANNER_AD_UNIT_ID = 'R-M-19446153-4';
    process.env.EXPO_PUBLIC_YANDEX_BANNER_AD_UNIT_ID = productionUnits.bannerAdUnitId;
    process.env.EXPO_PUBLIC_YANDEX_REWARDED_AD_UNIT_ID = productionUnits.rewardedAdUnitId;
    process.env.EXPO_PUBLIC_YANDEX_INTERSTITIAL_AD_UNIT_ID = productionUnits.interstitialAdUnitId;
  }

  beforeEach(() => {
    for (const key of envKeys) delete process.env[key];
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = originalDev;
    jest.resetModules();
  });

  it('uses the three current production blocks in store builds', () => {
    expect(readUnits()).toEqual(productionUnits);
  });

  it('keeps format-specific build overrides and never restores the home placement', () => {
    injectProductionEnv();
    process.env.EXPO_PUBLIC_YANDEX_BANNER_AD_UNIT_ID = 'R-M-1-1';
    process.env.EXPO_PUBLIC_YANDEX_REWARDED_AD_UNIT_ID = 'R-M-1-2';
    process.env.EXPO_PUBLIC_YANDEX_INTERSTITIAL_AD_UNIT_ID = 'R-M-1-3';
    expect(readUnits()).toEqual({
      homeBannerAdUnitId: '',
      bannerAdUnitId: 'R-M-1-1',
      rewardedAdUnitId: 'R-M-1-2',
      interstitialAdUnitId: 'R-M-1-3',
    });
  });

  it('forces demo units in Debug even with production env and a disabled QA flag', () => {
    injectProductionEnv();
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
    process.env.EXPO_PUBLIC_YANDEX_TEST_ADS = 'false';
    expect(readUnits()).toEqual(demoUnits);
  });

  it('forces demo units in isolated release QA even with production env', () => {
    injectProductionEnv();
    process.env.EXPO_PUBLIC_YANDEX_TEST_ADS = 'true';
    expect(readUnits()).toEqual(demoUnits);
  });

  it('uses production units when the release QA switch is disabled', () => {
    injectProductionEnv();
    process.env.EXPO_PUBLIC_YANDEX_TEST_ADS = 'false';
    expect(readUnits()).toEqual(productionUnits);
  });
});
