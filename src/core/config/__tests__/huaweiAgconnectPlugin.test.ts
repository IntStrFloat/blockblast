const {
  patchAppBuildGradle,
  patchProjectBuildGradle,
  validateAgconnectConfig,
} = jest.requireActual('../../../../plugins/withHuaweiAgconnect');

describe('Huawei AGConnect config plugin', () => {
  it('adds the Huawei repository and current AGConnect Gradle plugin idempotently', () => {
    const source = `buildscript {
  repositories {
    google()
    mavenCentral()
  }
  dependencies {
    classpath('com.android.tools.build:gradle')
    classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
  }
}

allprojects {
  repositories {
    google()
    mavenCentral()
  }
}
`;

    const patched = patchProjectBuildGradle(source);
    const patchedTwice = patchProjectBuildGradle(patched);

    expect(patched).toContain(
      "classpath('com.android.tools.build:gradle:8.12.0')",
    );
    expect(patched).toContain("maven { url 'https://developer.huawei.com/repo/' }");
    expect(patched).toContain("classpath('com.huawei.agconnect:agcp:1.9.6.300')");
    expect(patched.match(/developer\.huawei\.com\/repo/g)).toHaveLength(2);
    expect(patchedTwice).toBe(patched);
  });

  it('adds AGConnect core and applies the app plugin idempotently', () => {
    const source = `apply plugin: "com.android.application"

dependencies {
    implementation("com.facebook.react:react-android")
}
`;

    const patched = patchAppBuildGradle(source);
    const patchedTwice = patchAppBuildGradle(patched);

    expect(patched).toContain(
      'implementation("com.huawei.agconnect:agconnect-core:1.9.6.300")',
    );
    expect(patched).toContain('apply plugin: "com.huawei.agconnect"');
    expect(patchedTwice).toBe(patched);
  });

  it('rejects a Huawei config created for another Android package', () => {
    expect(() =>
      validateAgconnectConfig(
        { app_info: { package_name: 'com.example.other', app_id: 'present' } },
        'com.intstrfloat.blockblast',
      ),
    ).toThrow('package mismatch');
  });
});
