declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('rewarded helper charge source contract', () => {
  it('offers helper charges through rewarded ads after the free daily use is spent', () => {
    const hintSource = fs.readFileSync(`${__dirname}/../components/HelperHint.tsx`, 'utf8');
    const swapSource = fs.readFileSync(`${__dirname}/../components/HelperSwap.tsx`, 'utf8');
    const ruSource = fs.readFileSync(`${__dirname}/../../../core/i18n/ru.ts`, 'utf8');
    const enSource = fs.readFileSync(`${__dirname}/../../../core/i18n/en.ts`, 'utf8');

    expect(hintSource).toContain("showRewarded('helper_charge')");
    expect(hintSource).toContain("addHelperCharge('hint')");
    expect(hintSource).toContain('useRewardedReady(canOfferRewarded && !rewardBusy)');
    expect(hintSource).not.toContain('setRewardedReady');
    expect(hintSource).toContain('recordFullscreenCooldown(loadAdsMeta(), Date.now())');
    expect(hintSource).toContain('rewardInFlightRef.current');
    expect(hintSource).toContain("usedDay === today && charges === 0");
    expect(swapSource).toContain("showRewarded('helper_charge')");
    expect(swapSource).toContain("addHelperCharge('swap')");
    expect(swapSource).toContain('useRewardedReady(canOfferRewarded && !rewardBusy)');
    expect(swapSource).not.toContain('setRewardedReady');
    expect(swapSource).toContain('recordFullscreenCooldown(loadAdsMeta(), Date.now())');
    expect(swapSource).toContain('rewardInFlightRef.current');
    expect(swapSource).toContain("usedDay === today && charges === 0");
    expect(ruSource).toContain("adCharge: 'за видео'");
    expect(enSource).toContain("adCharge: 'for ad'");
  });
});
