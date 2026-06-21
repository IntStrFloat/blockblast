const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require('expo/config-plugins');

/**
 * Готовит Android-проект под RuStore push SDK:
 * - добавляет runtime-разрешение POST_NOTIFICATIONS (Android 13+).
 * Нативный messaging-сервис регистрируется autolinking-ом самого пакета.
 * Метадату канала/иконки уведомлений добавлять ПО ДОКАМ закреплённой версии SDK
 * на этапе нативной сборки (значения версионно-зависимы) — здесь НЕ задаём.
 */
function withRuStorePush(config, _props = {}) {
  return withAndroidManifest(config, (cfg) => {
    // ensurePermission дедуплицирует: пакет уже может объявлять это разрешение
    // в своём манифесте, повторного <uses-permission> не появится.
    AndroidConfig.Permissions.ensurePermission(
      cfg.modResults,
      'android.permission.POST_NOTIFICATIONS',
    );
    return cfg;
  });
}

module.exports = createRunOncePlugin(withRuStorePush, 'with-rustore-push', '1.0.0');
