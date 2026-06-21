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
function withRuStorePush(config) {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.addPermission(
      cfg.modResults,
      'android.permission.POST_NOTIFICATIONS',
    );
    return cfg;
  });
}

module.exports = createRunOncePlugin(withRuStorePush, 'withRuStorePush', '1.0.0');
