const {
  withAppMetrica,
  validateApiKey,
  stripLegacyGradle,
  stripLegacyMainApplication,
} = jest.requireActual('../../../../plugins/withAppMetrica');

describe('AppMetrica config plugin', () => {
  const apiKey = '00000000-0000-4000-8000-000000000001';

  it('exposes the API key without patching or activating the native SDK', () => {
    const config = withAppMetrica(
      { name: 'Block Blast', slug: 'blockblast', extra: { existing: true } },
      { apiKey },
    );

    expect(config.extra).toEqual({ existing: true, appMetricaApiKey: apiKey });
    expect(JSON.stringify(config)).not.toContain('AppMetrica.activate');
    expect(JSON.stringify(config)).not.toContain('io.appmetrica.analytics:analytics');
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

  it('removes legacy native activation left by earlier plugin versions', () => {
    const gradle = stripLegacyGradle(`
      buildConfigField "String", "APPMETRICA_API_KEY", "\\"key\\""
      implementation("io.appmetrica.analytics:analytics:8.3.0")
      implementation("com.facebook.react:react-android")
    `);
    expect(gradle).not.toContain('APPMETRICA');
    expect(gradle).not.toContain('io.appmetrica.analytics:analytics');
    expect(gradle).toContain('react-android');

    const main = stripLegacyMainApplication(`
import io.appmetrica.analytics.AppMetrica
import io.appmetrica.analytics.AppMetricaConfig
  override fun onCreate() {
    val appMetricaConfig =
      AppMetricaConfig.newConfigBuilder(BuildConfig.APPMETRICA_API_KEY).build()
    AppMetrica.activate(this, appMetricaConfig)
    loadReactNative(this)
  }
    `);
    expect(main).not.toContain('AppMetrica');
    expect(main).toContain('loadReactNative');
  });
});
