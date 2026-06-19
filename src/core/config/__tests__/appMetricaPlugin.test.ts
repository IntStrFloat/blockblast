const {
  patchAppBuildGradle,
  patchMainApplication,
  validateApiKey,
} = jest.requireActual('../../../../plugins/withAppMetrica');

describe('AppMetrica config plugin', () => {
  const apiKey = '00000000-0000-4000-8000-000000000001';

  it('adds the SDK dependency and API key BuildConfig field idempotently', () => {
    const source = `android {
  defaultConfig {
    applicationId 'com.intstrfloat.blockblast'
  }
}

dependencies {
  implementation("com.facebook.react:react-android")
}
`;

    const patched = patchAppBuildGradle(source, apiKey);
    const patchedTwice = patchAppBuildGradle(patched, apiKey);

    expect(patched).toContain(
      'implementation("io.appmetrica.analytics:analytics:8.3.0")',
    );
    expect(patched).toContain(
      'buildConfigField "String", "APPMETRICA_API_KEY"',
    );
    expect(patchedTwice).toBe(patched);
  });

  it('activates AppMetrica before React Native starts idempotently', () => {
    const source = `package com.intstrfloat.blockblast

import android.app.Application
import com.facebook.react.ReactApplication

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
`;

    const patched = patchMainApplication(source);
    const patchedTwice = patchMainApplication(patched);

    expect(patched).toContain('import io.appmetrica.analytics.AppMetrica');
    expect(patched).toContain(
      'AppMetricaConfig.newConfigBuilder(BuildConfig.APPMETRICA_API_KEY).build()',
    );
    expect(patched.indexOf('AppMetrica.activate')).toBeLessThan(
      patched.indexOf('loadReactNative(this)'),
    );
    expect(patchedTwice).toBe(patched);
  });

  it('rejects missing or malformed API keys', () => {
    expect(() => validateApiKey(undefined)).toThrow(
      'APPMETRICA_API_KEY is missing',
    );
    expect(() => validateApiKey('not-a-key')).toThrow(
      'APPMETRICA_API_KEY must be a UUID',
    );
    expect(validateApiKey(apiKey)).toBe(apiKey);
  });
});
