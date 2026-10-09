// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../withYandexVkMediation.js') as {
  addVkAdsMediationAdapter(contents: string): string;
  VK_ADS_MEDIATION_COORDINATE: string;
};

const { addVkAdsMediationAdapter, VK_ADS_MEDIATION_COORDINATE } = plugin;

const APP_BUILD_GRADLE = `
dependencies {
    implementation("com.facebook.react:react-android")
}
`;

describe('withYandexVkMediation config plugin', () => {
  it('adds the VK Ads mediation adapter to app dependencies', () => {
    const output = addVkAdsMediationAdapter(APP_BUILD_GRADLE);

    expect(output).toContain(VK_ADS_MEDIATION_COORDINATE);
  });

  it('is idempotent', () => {
    const once = addVkAdsMediationAdapter(APP_BUILD_GRADLE);

    expect(addVkAdsMediationAdapter(once)).toBe(once);
  });

  it('replaces an adapter version left by a previous prebuild', () => {
    const outdated = APP_BUILD_GRADLE.replace(
      'implementation("com.facebook.react:react-android")',
      'implementation("com.yandex.ads.mediation:mobileads-mytarget:5.45.3.3")',
    );
    const output = addVkAdsMediationAdapter(outdated);

    expect(output).toContain(VK_ADS_MEDIATION_COORDINATE);
    expect(output).not.toContain('mobileads-mytarget:5.45.3.3');
  });

  it('throws when the dependencies block is missing', () => {
    expect(() => addVkAdsMediationAdapter('android {}')).toThrow(
      /dependencies block/,
    );
  });
});
