const {
  createRunOncePlugin,
  withAppBuildGradle,
  withMainApplication,
} = require('expo/config-plugins');

const APPMETRICA_VERSION = '8.3.0';
const APPMETRICA_DEPENDENCY =
  `implementation("io.appmetrica.analytics:analytics:${APPMETRICA_VERSION}")`;
const API_KEY_FIELD = 'buildConfigField "String", "APPMETRICA_API_KEY"';

function validateApiKey(apiKey) {
  if (!apiKey) {
    throw new Error(
      'AppMetrica: APPMETRICA_API_KEY is missing. Add it to .env.local.',
    );
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      apiKey,
    )
  ) {
    throw new Error('AppMetrica: APPMETRICA_API_KEY must be a UUID.');
  }
  return apiKey;
}

function escapeGradleString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function patchAppBuildGradle(contents, apiKey) {
  const validatedApiKey = validateApiKey(apiKey);
  let next = contents;

  if (!next.includes('io.appmetrica.analytics:analytics:')) {
    if (!/dependencies\s*\{/.test(next)) {
      throw new Error('AppMetrica: app dependencies block was not found');
    }
    next = next.replace(
      /dependencies\s*\{/,
      `dependencies {\n    ${APPMETRICA_DEPENDENCY}`,
    );
  }

  if (!next.includes(API_KEY_FIELD)) {
    const defaultConfigPattern = /(defaultConfig\s*\{)/;
    if (!defaultConfigPattern.test(next)) {
      throw new Error('AppMetrica: android.defaultConfig block was not found');
    }
    const escapedApiKey = escapeGradleString(validatedApiKey);
    next = next.replace(
      defaultConfigPattern,
      `$1\n        ${API_KEY_FIELD}, "\\"${escapedApiKey}\\""`,
    );
  }

  return next;
}

function patchMainApplication(contents) {
  let next = contents;

  if (!next.includes('import io.appmetrica.analytics.AppMetrica\n')) {
    const packageLine = /^(package\s+[^\r\n]+[\r\n]+)/;
    if (!packageLine.test(next)) {
      throw new Error('AppMetrica: MainApplication package declaration was not found');
    }
    next = next.replace(
      packageLine,
      `$1\nimport io.appmetrica.analytics.AppMetrica\nimport io.appmetrica.analytics.AppMetricaConfig\n`,
    );
  }

  if (!next.includes('AppMetrica.activate(this, appMetricaConfig)')) {
    const superOnCreate = /(\s+super\.onCreate\(\)\r?\n)/;
    if (!superOnCreate.test(next)) {
      throw new Error('AppMetrica: MainApplication.onCreate was not found');
    }
    next = next.replace(
      superOnCreate,
      `$1    val appMetricaConfig =\n      AppMetricaConfig.newConfigBuilder(BuildConfig.APPMETRICA_API_KEY).build()\n    AppMetrica.activate(this, appMetricaConfig)\n`,
    );
  }

  return next;
}

const withAppMetrica = (config, options = {}) => {
  const apiKey = validateApiKey(
    options.apiKey ?? process.env.APPMETRICA_API_KEY,
  );

  config = withAppBuildGradle(config, (appConfig) => {
    if (appConfig.modResults.language !== 'groovy') {
      throw new Error('AppMetrica currently supports only Groovy build.gradle files');
    }
    appConfig.modResults.contents = patchAppBuildGradle(
      appConfig.modResults.contents,
      apiKey,
    );
    return appConfig;
  });

  config = withMainApplication(config, (mainApplicationConfig) => {
    if (mainApplicationConfig.modResults.language !== 'kt') {
      throw new Error('AppMetrica currently supports only Kotlin MainApplication');
    }
    mainApplicationConfig.modResults.contents = patchMainApplication(
      mainApplicationConfig.modResults.contents,
    );
    return mainApplicationConfig;
  });

  return config;
};

const plugin = createRunOncePlugin(
  withAppMetrica,
  'with-appmetrica',
  '1.0.0',
);

module.exports = plugin;
module.exports.patchAppBuildGradle = patchAppBuildGradle;
module.exports.patchMainApplication = patchMainApplication;
module.exports.validateApiKey = validateApiKey;
