const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withProjectBuildGradle,
} = require('expo/config-plugins');

// Интеграция react-native-rustore-push 6.x (GitFlic):
// 1) maven-репозиторий RuStore, откуда тянется нативный `ru.rustore.sdk:pushclient`;
// 2) meta-data `project_id` — по нему SDK инициализируется автоматически;
// 3) разрешение POST_NOTIFICATIONS (Android 13+).
// Messaging-сервис (.RustorePushService) и params_class пакет объявляет САМ в своём
// манифесте (autolinking merge) — здесь его задавать НЕ нужно.
const RUSTORE_MAVEN_URL =
  'https://nexus-external.rustore.ru/repository/maven-rustore-exposed/';
const RUSTORE_MAVEN = `maven { url '${RUSTORE_MAVEN_URL}'; content { includeGroupByRegex 'ru[.]rustore([.].*)?' } }`;
const TRACER_MAVEN = "maven { url 'https://nexus-external.vkteam.ru/repository/maven/'; content { includeGroup 'ru.ok.tracer' } }";
const PROJECT_ID_META = 'ru.rustore.sdk.pushclient.project_id';

/** Добавляет maven-репозиторий RuStore в allprojects.repositories (идемпотентно). */
function patchProjectBuildGradle(contents) {
  // Remove the legacy endpoint and put RuStore before JitPack, whose 401
  // stops Gradle resolution before it can try subsequent repositories.
  const cleaned = contents.replace(
    /maven\s*\{\s*url\s*(?:=\s*)?['"]https:\/\/(?:artifactory-external\.vkpartner\.ru\/artifactory\/maven\/?|nexus-external\.rustore\.ru\/repository\/maven-rustore-exposed\/|nexus-external\.vkteam\.ru\/repository\/maven\/)['"](?:\s*;?\s*content\s*\{[^{}]*\})?\s*;?\s*\}/g,
    '',
  );
  const pattern = /(allprojects\s*\{\s*repositories\s*\{)/;
  if (!pattern.test(cleaned)) {
    throw new Error(
      'RuStore Push: allprojects.repositories block was not found in android/build.gradle',
    );
  }
  return cleaned.replace(pattern, `$1\n    ${RUSTORE_MAVEN}\n    ${TRACER_MAVEN}`).replace(/\n(?:[ \t]*\n)+/g, '\n');
}

/** Прописывает meta-data project_id в manifest (upsert), для авто-инициализации SDK. */
function addProjectIdMeta(androidManifest, projectId) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    app,
    PROJECT_ID_META,
    projectId,
  );
  return androidManifest;
}

function withRuStorePush(config, props = {}) {
  const projectId =
    props.projectId ?? process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID ?? '';

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
    // project_id берётся из env (EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID) на этапе prebuild.
    // Если пуст (dev/CI без значения) — meta-data не добавляем, чтобы не плодить пустоту.
    if (projectId) {
      addProjectIdMeta(manifestConfig.modResults, projectId);
    }
    return manifestConfig;
  });

  return config;
}

const plugin = createRunOncePlugin(withRuStorePush, 'with-rustore-push', '2.0.0');

module.exports = plugin;
module.exports.patchProjectBuildGradle = patchProjectBuildGradle;
module.exports.addProjectIdMeta = addProjectIdMeta;
