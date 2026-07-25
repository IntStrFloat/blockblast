const {
  createRunOncePlugin,
  withAppBuildGradle,
  withMainApplication,
} = require('expo/config-plugins');

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

/**
 * The official React Native package owns native dependency linking and SDK
 * activation. This plugin only exposes the non-secret application key to the
 * JS runtime. Keeping native activation here as well would start AppMetrica
 * twice and can split the first session.
 */
function stripLegacyGradle(contents) {
  return contents
    .replace(/^\s*buildConfigField\s+"String",\s*"APPMETRICA_API_KEY".*\r?\n/gm, '')
    .replace(/^\s*implementation\(["']io\.appmetrica\.analytics:analytics:[^"']+["']\)\s*\r?\n/gm, '');
}

function stripLegacyMainApplication(contents) {
  return contents
    .replace(/^import io\.appmetrica\.analytics\.AppMetrica\r?\n/gm, '')
    .replace(/^import io\.appmetrica\.analytics\.AppMetricaConfig\r?\n/gm, '')
    .replace(
      /^\s*val appMetricaConfig =\s*\r?\n\s*AppMetricaConfig\.newConfigBuilder\(BuildConfig\.APPMETRICA_API_KEY\)\.build\(\)\s*\r?\n\s*AppMetrica\.activate\(this, appMetricaConfig\)\s*\r?\n/gm,
      '',
    );
}

function withAppMetrica(config, options = {}) {
  const apiKey = validateApiKey(
    options.apiKey ?? process.env.APPMETRICA_API_KEY,
  );

  let next = {
    ...config,
    extra: {
      ...config.extra,
      appMetricaApiKey: apiKey,
    },
  };
  next = withAppBuildGradle(next, (gradleConfig) => {
    gradleConfig.modResults.contents = stripLegacyGradle(gradleConfig.modResults.contents);
    return gradleConfig;
  });
  next = withMainApplication(next, (mainConfig) => {
    mainConfig.modResults.contents = stripLegacyMainApplication(mainConfig.modResults.contents);
    return mainConfig;
  });
  return next;
}

const plugin = createRunOncePlugin(withAppMetrica, 'with-appmetrica', '2.0.0');

module.exports = plugin;
module.exports.withAppMetrica = withAppMetrica;
module.exports.validateApiKey = validateApiKey;
module.exports.stripLegacyGradle = stripLegacyGradle;
module.exports.stripLegacyMainApplication = stripLegacyMainApplication;
