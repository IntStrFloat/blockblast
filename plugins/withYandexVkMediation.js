const {
  createRunOncePlugin,
  withAppBuildGradle,
  withGradleProperties,
  withProjectBuildGradle,
} = require('expo/config-plugins');

// Official RN Easy Monetization bundle: all supported networks stay managed by Yandex.
const YANDEX_MEDIATION_COORDINATE = 'com.yandex.android:mobileads-mediation:8.6.0.0';
// Resolved Chartboost 9.14.1 contains Kotlin 2.3 metadata. Match its compiler
// rather than suppressing metadata checks or downgrading a mediated runtime.
const KOTLIN_VERSION = '2.3.0';
// https://ads.yandex.com/helpcenter/ru/easy/integration/react-native/integration/mediation
// BidMachine's official repository also hosts its Explorestack dependencies.
const MEDIATION_REPOSITORIES = [
  ['https://android-sdk.is.com/', ['com[.]ironsource([.].*)?', 'com[.]unity3d[.]ads-mediation']],
  ['https://artifact.bytedance.com/repository/pangle', ['com[.]pangle([.].*)?', 'com[.]bytedance([.].*)?']],
  ['https://sdk.tapjoy.com/', ['com[.]tapjoy']],
  ['https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea', ['com[.]mbridge([.].*)?']],
  ['https://cboost.jfrog.io/artifactory/chartboost-ads/', ['com[.]chartboost', 'com[.]iab[.]omid[.]library']],
  ['https://dl.appnext.com/', ['com[.]appnext([.].*)?']],
  ['https://developer.huawei.com/repo/', ['com[.]huawei([.].*)?']],
  ['https://artifactory.bidmachine.io/bidmachine', ['io[.]bidmachine([.].*)?', 'com[.]explorestack([.].*)?']],
];

function addYandexMediation(contents) {
  const dependenciesBlock = /dependencies\s*\{/;
  if (!dependenciesBlock.test(contents)) {
    throw new Error('Yandex mediation: dependencies block was not found in android/app/build.gradle');
  }
  // Remove the previous direct core/strict pin and any standalone adapters. The
  // wrapper's own core dependency is resolved transitively against the bundle.
  const cleaned = contents.replace(
    /^[ \t]*implementation[ \t]*(?:\([ \t]*)?['"](?:com\.yandex\.android:mobileads(?:-mediation)?|com\.yandex\.ads\.mediation:mobileads-[^:'"]+):[^'"]+['"][ \t]*\)?(?:[ \t]*\{\s*version\s*\{\s*strictly\(['"][^'"]+['"]\)\s*\}\s*\})?[ \t]*(?:\r?\n)?/gm,
    '',
  );
  return cleaned.replace(dependenciesBlock, `$&\n    implementation("${YANDEX_MEDIATION_COORDINATE}")`);
}

function addYandexMediationRepositories(contents) {
  // The RN buildscript otherwise supplies its own older compiler classpath,
  // even when Expo's version catalog reports the overridden Kotlin version.
  contents = contents.replace(
    /classpath\(?['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]+)?['"]\)?/,
    `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}")`,
  );
  const repositoriesBlock = /(allprojects\s*\{\s*repositories\s*\{)/;
  const opening = repositoriesBlock.exec(contents);
  if (!opening) {
    throw new Error('Yandex mediation: allprojects.repositories block was not found in android/build.gradle');
  }
  const start = opening.index + opening[0].length;
  let depth = 1;
  let end = start;
  while (end < contents.length && depth > 0) {
    if (contents[end] === '{') depth += 1;
    if (contents[end] === '}') depth -= 1;
    end += 1;
  }
  if (depth !== 0) throw new Error('Yandex mediation: unbalanced repositories block');
  const body = contents.slice(start, end - 1);
  let updated = body;
  const missing = [];
  for (const [url, groups] of MEDIATION_REPOSITORIES) {
    const declaration = `maven { url '${url}'; content { ${groups.map((group) => `includeGroupByRegex '${group}'`).join('; ')} } }`;
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = new RegExp(`maven\\s*\\{\\s*url\\s*(?:=\\s*)?['"]${escaped}['"](?:\\s*;?\\s*content\\s*\\{[^{}]*\\})?\\s*;?\\s*\\}`, 'g');
    if (existing.test(updated)) {
      updated = updated.replace(existing, declaration);
    } else {
      missing.push(`    ${declaration}`);
    }
  }
  // Keep the original closing indentation; append only absent vendor entries.
  if (missing.length) updated = updated.replace(/\s*$/, `\n${missing.join('\n')}\n  `);
  return contents.slice(0, start) + updated + contents.slice(end - 1);
}

function configureMediationGradleProperties(properties) {
  const previous = properties.find((entry) => entry.type === 'property' && entry.key === 'org.gradle.jvmargs')?.value ?? '';
  const minimumMemory = (value, pattern, minimumMb, flag) => {
    if (!pattern.test(value)) return `${value} ${flag}`.trim();
    return value.replace(pattern, (existing, count, unit) => {
      const megabytes = Number(count) * (unit.toLowerCase() === 'g' ? 1024 : 1);
      return megabytes >= minimumMb ? existing : flag;
    });
  };
  let jvmArgs = minimumMemory(previous, /-Xmx(\d+)([gm])/i, 6144, '-Xmx6144m');
  jvmArgs = minimumMemory(jvmArgs, /-XX:MaxMetaspaceSize=(\d+)([gm])/i, 1024, '-XX:MaxMetaspaceSize=1024m');
  return [
    ...properties.filter((entry) => entry.type !== 'property' || !['android.kotlinVersion', 'org.gradle.jvmargs'].includes(entry.key)),
    { type: 'property', key: 'android.kotlinVersion', value: KOTLIN_VERSION },
    { type: 'property', key: 'org.gradle.jvmargs', value: jvmArgs },
  ];
}

function withYandexVkMediation(config) {
  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Yandex mediation requires Groovy Gradle');
    mod.modResults.contents = addYandexMediation(mod.modResults.contents);
    return mod;
  });
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Yandex mediation requires Groovy Gradle');
    mod.modResults.contents = addYandexMediationRepositories(mod.modResults.contents);
    return mod;
  });
  return withGradleProperties(config, (mod) => {
    mod.modResults = configureMediationGradleProperties(mod.modResults);
    return mod;
  });
}

module.exports = createRunOncePlugin(withYandexVkMediation, 'with-yandex-vk-mediation', '2.0.0');
module.exports.addYandexMediation = addYandexMediation;
module.exports.addYandexMediationRepositories = addYandexMediationRepositories;
module.exports.YANDEX_MEDIATION_COORDINATE = YANDEX_MEDIATION_COORDINATE;
module.exports.MEDIATION_REPOSITORIES = MEDIATION_REPOSITORIES;
module.exports.configureMediationGradleProperties = configureMediationGradleProperties;
module.exports.KOTLIN_VERSION = KOTLIN_VERSION;
