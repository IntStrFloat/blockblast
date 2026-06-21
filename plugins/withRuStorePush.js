const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withProjectBuildGradle,
} = require('expo/config-plugins');

// Требования интеграции react-native-rustore-push (см. README пакета):
// 1) maven-репозиторий RuStore, откуда тянется нативный `ru.rustore.sdk:pushclient`;
// 2) объявление messaging-сервиса, через который SDK доставляет данные пуша;
// 3) разрешение POST_NOTIFICATIONS (Android 13+).
// Метадату канала/иконки этот SDK не требует (канал создаёт сам).
const RUSTORE_MAVEN_URL =
  'https://artifactory-external.vkpartner.ru/artifactory/maven';
const RUSTORE_MAVEN = `maven { url '${RUSTORE_MAVEN_URL}' }`;
const MESSAGING_SERVICE = 'ru.reactnativerustorepush.deps.MessagingService';
const MESSAGING_EVENT_ACTION = 'ru.rustore.sdk.pushclient.MESSAGING_EVENT';

/** Добавляет maven-репозиторий RuStore в allprojects.repositories (идемпотентно). */
function patchProjectBuildGradle(contents) {
  if (contents.includes(RUSTORE_MAVEN_URL)) {
    return contents;
  }
  const pattern = /(allprojects\s*\{\s*repositories\s*\{)([\s\S]*?)(\n\s*\})/;
  if (!pattern.test(contents)) {
    throw new Error(
      'RuStore Push: allprojects.repositories block was not found in android/build.gradle',
    );
  }
  return contents.replace(pattern, `$1$2\n    ${RUSTORE_MAVEN}$3`);
}

/** Объявляет messaging-сервис RuStore в AndroidManifest (идемпотентно). */
function addMessagingService(androidManifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  app.service = app.service ?? [];
  const already = app.service.some(
    (service) => service.$?.['android:name'] === MESSAGING_SERVICE,
  );
  if (!already) {
    app.service.push({
      $: {
        'android:name': MESSAGING_SERVICE,
        'android:exported': 'true',
      },
      'intent-filter': [
        { action: [{ $: { 'android:name': MESSAGING_EVENT_ACTION } }] },
      ],
    });
  }
  return androidManifest;
}

function withRuStorePush(config, _props = {}) {
  config = withProjectBuildGradle(config, (projectConfig) => {
    if (projectConfig.modResults.language !== 'groovy') {
      throw new Error('RuStore Push: only Groovy android/build.gradle is supported');
    }
    projectConfig.modResults.contents = patchProjectBuildGradle(
      projectConfig.modResults.contents,
    );
    return projectConfig;
  });

  config = withAndroidManifest(config, (manifestConfig) => {
    AndroidConfig.Permissions.ensurePermission(
      manifestConfig.modResults,
      'android.permission.POST_NOTIFICATIONS',
    );
    addMessagingService(manifestConfig.modResults);
    return manifestConfig;
  });

  return config;
}

const plugin = createRunOncePlugin(withRuStorePush, 'with-rustore-push', '1.0.0');

module.exports = plugin;
module.exports.patchProjectBuildGradle = patchProjectBuildGradle;
module.exports.addMessagingService = addMessagingService;
