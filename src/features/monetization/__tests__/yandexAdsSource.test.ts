declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('Yandex ads diagnostics source contract', () => {
  it('reports native load and show failures instead of swallowing them', () => {
    const providerSource = fs.readFileSync(`${__dirname}/../yandexAds.native.ts`, 'utf8');
    const bannerSource = fs.readFileSync(`${__dirname}/../AdBanner.native.tsx`, 'utf8');
    const monetizationTypesSource = fs.readFileSync(`${__dirname}/../types.ts`, 'utf8');
    const analyticsTypesSource = fs.readFileSync(
      `${__dirname}/../../analytics/types.ts`,
      'utf8',
    );

    expect(providerSource).toContain('function reportAdsError');
    expect(providerSource).toContain("reportAdsError('interstitial load', error)");
    expect(providerSource).toContain("reportAdsError('rewarded load', error)");
    expect(providerSource).toContain("reportAdsError('SDK initialization', error)");
    expect(providerSource).toContain("reportAdsError('interstitial show', error)");
    expect(providerSource).toContain("reportAdsError('rewarded show', error)");
    expect(providerSource).toContain("track('ad_requested'");
    expect(providerSource).toContain("track('ad_loaded'");
    expect(providerSource).toContain("track('ad_shown'");
    expect(providerSource).toContain("track('ad_clicked'");
    expect(providerSource).toContain("track('ad_dismissed'");
    expect(providerSource).toContain("track('ad_rewarded'");
    expect(providerSource).toContain("track('ad_failed'");
    expect(providerSource).toContain('ad.onAdImpression = (data) =>');
    expect(providerSource).toContain('ad.onAdClicked = () => {');
    expect(providerSource).toContain('telemetry?: InterstitialTelemetry');
    expect(providerSource).toContain('attempt_id: attemptId, ...telemetry');
    expect(providerSource).toContain("track('ad_load_requested'");
    expect(providerSource).toContain("placement: 'preload'");
    expect(providerSource).toContain('interstitialAdLoadId = loadId');
    expect(providerSource).not.toContain("trackAdLoaded('interstitial', placement");
    expect(providerSource).toContain('onImpression?.()');
    expect(providerSource).not.toContain("trackAdLoaded('rewarded', placement, attemptId);");
    expect(providerSource).toContain('void prepareInterstitial();');
    expect(providerSource).toContain('subscribeRewardedReady:');
    expect(providerSource).not.toContain('void preloadInterstitial(placement, attemptId);');
    expect(providerSource).not.toContain('void preloadRewarded(placement, attemptId);');
    expect(providerSource).not.toContain("ad.onAdDismissed = () => {\r\n      trackAdShown");
    expect(bannerSource).toContain('onAdFailedToLoad');
    expect(bannerSource).toContain("console.warn('[ads] Yandex banner failed to load'");
    expect(bannerSource).toContain("track('ad_requested'");
    expect(bannerSource).toContain("track('ad_loaded'");
    expect(bannerSource).toContain("track('ad_shown'");
    expect(bannerSource).toContain("track('ad_clicked'");
    expect(bannerSource).toContain("track('ad_failed'");
    expect(bannerSource).toContain('onAdLoaded={() => {');
    expect(bannerSource).toContain('onAdImpression={(event) => {');
    expect(bannerSource).not.toContain(
      "BannerAdSize.stickySize(width)\r\n      .then((nextSize) => {\r\n        if (active) {\r\n          setSize(nextSize);\r\n          useAnalyticsStore",
    );
    expect(bannerSource).not.toContain("onAdLoaded={() => {\r\n          useAnalyticsStore.getState().track('ad_shown'");
    expect(analyticsTypesSource).toContain('ad_loaded: {');
    expect(analyticsTypesSource).toContain('ad_clicked: {');
    expect(analyticsTypesSource).toContain('ad_dismissed: {');
    expect(analyticsTypesSource).toContain('ad_rewarded: {');
    expect(analyticsTypesSource).toContain('attempt_id?: string;');
    expect(monetizationTypesSource).toContain(
      "export type RewardedPlacement = 'revive' | 'helper_charge' | 'adventure_xp_bonus';",
    );
  });
});
