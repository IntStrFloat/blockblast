declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('Yandex ads diagnostics source contract', () => {
  it('reports native load and show failures instead of swallowing them', () => {
    const providerSource = fs.readFileSync(`${__dirname}/../yandexAds.native.ts`, 'utf8');
    const bannerSource = fs.readFileSync(`${__dirname}/../AdBanner.native.tsx`, 'utf8');

    expect(providerSource).toContain('function reportAdsError');
    expect(providerSource).toContain("reportAdsError('interstitial load', error)");
    expect(providerSource).toContain("reportAdsError('rewarded load', error)");
    expect(providerSource).toContain("reportAdsError('SDK initialization', error)");
    expect(providerSource).toContain("reportAdsError('interstitial show', error)");
    expect(providerSource).toContain("reportAdsError('rewarded show', error)");
    expect(bannerSource).toContain('onAdFailedToLoad');
    expect(bannerSource).toContain("console.warn('[ads] Yandex banner failed to load'");
  });
});
