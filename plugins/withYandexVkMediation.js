const {
  createRunOncePlugin,
  withAppBuildGradle,
} = require('expo/config-plugins');

const VK_ADS_MEDIATION_COORDINATE =
  'com.yandex.ads.mediation:mobileads-mytarget:5.45.3.4';
const VK_ADS_MEDIATION_DEPENDENCY =
  `implementation("${VK_ADS_MEDIATION_COORDINATE}")`;
const VK_ADS_MEDIATION_DEPENDENCY_PATTERN =
  /^[ \t]*implementation\([ \t]*['"]com\.yandex\.ads\.mediation:mobileads-mytarget:[^'"]+['"][ \t]*\)[ \t]*(?:\r?\n)?/gm;

function addVkAdsMediationAdapter(contents) {
  const dependenciesBlock = /dependencies\s*\{/;
  if (!dependenciesBlock.test(contents)) {
    throw new Error(
      'VK Ads mediation: dependencies block was not found in android/app/build.gradle',
    );
  }

  const withoutExistingAdapter = contents.replace(
    VK_ADS_MEDIATION_DEPENDENCY_PATTERN,
    '',
  );

  return withoutExistingAdapter.replace(
    dependenciesBlock,
    `$&\n    ${VK_ADS_MEDIATION_DEPENDENCY}`,
  );
}

function withYandexVkMediation(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error(
        'VK Ads mediation: only Groovy android/app/build.gradle is supported',
      );
    }
    gradleConfig.modResults.contents = addVkAdsMediationAdapter(
      gradleConfig.modResults.contents,
    );
    return gradleConfig;
  });
}

const plugin = createRunOncePlugin(
  withYandexVkMediation,
  'with-yandex-vk-mediation',
  '1.0.0',
);

module.exports = plugin;
module.exports.addVkAdsMediationAdapter = addVkAdsMediationAdapter;
module.exports.VK_ADS_MEDIATION_COORDINATE = VK_ADS_MEDIATION_COORDINATE;
