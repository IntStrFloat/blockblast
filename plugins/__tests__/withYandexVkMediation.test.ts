// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../withYandexVkMediation.js') as {
  addYandexMediation(contents: string): string;
  addYandexMediationRepositories(contents: string): string;
  YANDEX_MEDIATION_COORDINATE: string;
  MEDIATION_REPOSITORIES: readonly (readonly [string, readonly string[]])[];
  configureMediationGradleProperties(properties: GradleProperty[]): GradleProperty[];
  KOTLIN_VERSION: string;
};

type GradleProperty = { type: 'property'; key: string; value: string } | { type: 'comment'; value: string };

const APP_BUILD_GRADLE = `dependencies {
    implementation("com.facebook.react:react-android")
}`;
const PROJECT_BUILD_GRADLE = `buildscript {
  repositories { google() }
  dependencies { classpath('org.jetbrains.kotlin:kotlin-gradle-plugin') }
}
allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://developer.huawei.com/repo/' }
  }
}`;

describe('withYandexVkMediation config plugin', () => {
  it('uses the recommended unified mediation without a direct core pin or standalone adapter', () => {
    const output = plugin.addYandexMediation(APP_BUILD_GRADLE);
    expect(plugin.YANDEX_MEDIATION_COORDINATE).toBe('com.yandex.android:mobileads-mediation:8.6.0.0');
    expect(output).toContain(plugin.YANDEX_MEDIATION_COORDINATE);
    expect(output).not.toContain('strictly');
    expect(output).not.toContain('com.yandex.android:mobileads:');
    expect(output).not.toContain('com.yandex.ads.mediation:');
    expect(output).toContain('com.facebook.react:react-android');
    expect(plugin.addYandexMediation(output)).toBe(output);
  });

  it('migrates previous generated core pins, standalone adapters and unified versions', () => {
    const input = APP_BUILD_GRADLE.replace('dependencies {', `dependencies {
    implementation("com.yandex.android:mobileads:8.6.0") { version { strictly("8.6.0") } }
    implementation('com.yandex.ads.mediation:mobileads-mytarget:5.51.2.2')
    implementation "com.yandex.ads.mediation:mobileads-applovin:13.0.0.0"
    implementation("com.yandex.android:mobileads-mediation:8.5.0.0")`);
    const output = plugin.addYandexMediation(input);
    expect(output.match(/mobileads-mediation:/g)).toHaveLength(1);
    expect(output).not.toContain('strictly');
    expect(output).not.toContain('com.yandex.ads.mediation:');
    expect(output).not.toContain('mobileads:8.6.0');
    expect(plugin.addYandexMediation(output)).toBe(output);
  });

  it('adds all official vendor repositories once, preserving other project configuration', () => {
    const output = plugin.addYandexMediationRepositories(PROJECT_BUILD_GRADLE);
    for (const [url] of plugin.MEDIATION_REPOSITORIES) {
      expect(output.split(url)).toHaveLength(2);
    }
    expect(output).toContain('buildscript {\n  repositories { google() }');
    expect(output).toContain('mavenCentral()');
    expect(output).toContain('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.0")');
    expect(output).toContain("includeGroupByRegex 'com[.]explorestack([.].*)?'");
    expect(output).toContain("includeGroupByRegex 'com[.]iab[.]omid[.]library'");
    expect(plugin.addYandexMediationRepositories(output)).toBe(output);
  });

  it('updates an explicitly versioned compiler classpath from an earlier native build', () => {
    const input = PROJECT_BUILD_GRADLE.replace('org.jetbrains.kotlin:kotlin-gradle-plugin', 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.20');
    const output = plugin.addYandexMediationRepositories(input);
    expect(output).toContain('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.0")');
    expect(output).not.toContain('kotlin-gradle-plugin:2.1.20');
    expect(plugin.addYandexMediationRepositories(output)).toBe(output);
  });

  it('repairs earlier restricted vendor repositories so transitive groups resolve', () => {
    const input = PROJECT_BUILD_GRADLE.replace('mavenCentral()', `mavenCentral()
    maven { url 'https://artifactory.bidmachine.io/bidmachine'; content { includeGroup 'io.bidmachine' } }
    maven { url 'https://cboost.jfrog.io/artifactory/chartboost-ads/'; content { includeGroup 'com.chartboost' } }`);
    const output = plugin.addYandexMediationRepositories(input);
    expect(output).toContain("includeGroupByRegex 'com[.]explorestack([.].*)?'");
    expect(output).toContain("includeGroupByRegex 'com[.]iab[.]omid[.]library'");
    expect(plugin.addYandexMediationRepositories(output)).toBe(output);
  });

  it('fails clearly when expected Gradle blocks are absent', () => {
    expect(() => plugin.addYandexMediation('android {}')).toThrow(/dependencies block/);
    expect(() => plugin.addYandexMediationRepositories('buildscript {}')).toThrow(/allprojects.repositories block/);
  });
});

describe('mediation Gradle toolchain and memory', () => {
  const property = (key: string, value: string): GradleProperty => ({ type: 'property', key, value });
  const valueOf = (entries: GradleProperty[], key: string) => entries.find((entry) => entry.type === 'property' && entry.key === key)?.value;

  it('sets a compatible Kotlin compiler and memory floors when properties are missing', () => {
    const output = plugin.configureMediationGradleProperties([]);
    expect(plugin.KOTLIN_VERSION).toBe('2.3.0');
    expect(valueOf(output, 'android.kotlinVersion')).toBe('2.3.0');
    expect(valueOf(output, 'org.gradle.jvmargs')).toBe('-Xmx6144m -XX:MaxMetaspaceSize=1024m');
    expect(plugin.configureMediationGradleProperties(output)).toEqual(output);
  });

  it('raises template memory while preserving unrelated flags, comments and properties', () => {
    const other = [
      { type: 'comment', value: 'Keep Hermes enabled' } as const,
      property('hermesEnabled', 'true'),
      property('newArchEnabled', 'true'),
    ];
    const output = plugin.configureMediationGradleProperties([
      ...other,
      property('android.kotlinVersion', '2.1.20'),
      property('org.gradle.jvmargs', '-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8 -XX:+HeapDumpOnOutOfMemoryError'),
    ]);
    expect(output.slice(0, other.length)).toEqual(other);
    expect(valueOf(output, 'org.gradle.jvmargs')).toBe('-Xmx6144m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8 -XX:+HeapDumpOnOutOfMemoryError');
    expect(plugin.configureMediationGradleProperties(output)).toEqual(output);
  });

  it.each([
    '-Xmx8g -XX:MaxMetaspaceSize=2g -Dfile.encoding=UTF-8',
    '-Xmx8192M -XX:MaxMetaspaceSize=2048M -XX:+UseParallelGC',
    '-Xmx6G -XX:MaxMetaspaceSize=1G',
  ])('preserves existing sufficient or higher limits: %s', (jvmArgs) => {
    const output = plugin.configureMediationGradleProperties([property('org.gradle.jvmargs', jvmArgs)]);
    expect(valueOf(output, 'org.gradle.jvmargs')).toBe(jvmArgs);
  });

  it('adds only the missing limit and replaces duplicate generated property entries', () => {
    const output = plugin.configureMediationGradleProperties([
      property('org.gradle.jvmargs', '-Xmx8g -XX:+UseParallelGC'),
      property('android.kotlinVersion', '2.0.21'),
      property('android.kotlinVersion', '2.1.20'),
    ]);
    expect(valueOf(output, 'org.gradle.jvmargs')).toBe('-Xmx8g -XX:+UseParallelGC -XX:MaxMetaspaceSize=1024m');
    expect(output.filter((entry) => entry.type === 'property' && entry.key === 'android.kotlinVersion')).toHaveLength(1);
  });
});
