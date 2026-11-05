# Релиз 1.1.43 · versionCode 48

Подписанный AAB: [blockblast-1.1.43-vc48.aab](../dist/blockblast-1.1.43-vc48.aab).

- Пакет: `com.intstrfloat.blockblast`.
- Размер: **90 989 655 байт / 86,77 MiB**.
- SHA-256 AAB: `8CD20AC3E4B4E36EF1EF996752E781A44465EAF24B330D587C1E171E19A5BF32`.
- SHA-256 сертификата: `74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3`.
- Подпись существующим `credentials/release.jks`; ключ не заменялся.
- ABI: `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`; minSdk 24, targetSdk 36; debuggable=false.

## Изменения

В `src/app/game.tsx` исправлена область нажатий помощников Капи. Родитель высотой 15 dp рисовал кнопки высотой 44 dp за своими границами, где Android не выполнял hit-testing. Теперь родитель имеет реальную высоту 70 dp, а отрицательный margin сохраняет прежнее положение поля и трея. Слой поднят над HUD; `box-none` сохраняет доступ к остальным элементам управления. Регрессия добавлена в `src/features/mascot/__tests__/helperControlsDecoupling.test.ts`.

В `plugins/withYandexVkMediation.js` закреплён **нативный Yandex Mobile Ads 8.6.0** с `strictly("8.6.0")`. Обновлён существующий адаптер MyTarget до **5.51.2.2**, рассчитанного на SDK 8.6.x. React Native-обёртка обновлена с 8.3.0 до **8.5.0** — последней опубликованной версии обёртки на момент работы; её номер отличается от версии нативного Android SDK. Конфигурация воспроизводится при prebuild, покрыта тестами плагина.

Версии повышены в `app.json`, `package.json`, `package-lock.json` и сохранённом `android/app/build.gradle`.

Добавлен `metro.config.js`: исключены корневые каталоги с собранными файлами, старыми checkout и образами эмулятора; кэш file map разделён по major-версии Node. Исходники, assets и dist-каталоги внутри node_modules остаются доступны. Это устраняет повторное сканирование артефактов и конфликт старого кэша.

## Проверки

- ESLint: 0 ошибок, 2 существующих предупреждения в `adventure/logic/seasons.ts` и `mascot/logic/types.ts`; новый Metro config также проходит lint.
- TypeScript: PASS.
- Jest: **180 наборов, 1186 тестов PASS**.
- Backend: **16 тестов PASS**.
- `git diff --check`: PASS.
- Gradle `releaseRuntimeClasspath`: выбран `com.yandex.android:mobileads:8.6.0`, включая запрос обёртки 8.5.0 и ограничение адаптера 8.6.x.
- `bundleRelease --rerun-tasks`: **BUILD SUCCESSFUL, 822 задачи выполнены**. Ограничивалась параллельность C++-компиляции по доступной памяти; параметры компиляции и набор ABI сохранены.
- `jarsigner`: exit 0, `jar verified.`. Присутствуют предупреждения о self-signed certificate, отсутствии timestamp и порядке записей ZIP/JarInputStream; проверка JarFile и bundletool успешна.
- `keytool`: сертификат совпадает с опубликованным ключом.
- `bundletool validate`: PASS; manifest подтверждает пакет, версию 1.1.43 и код 48.
- JS asset внутри AAB побайтно совпадает с проверенным release bundle. Sourcemap содержит исправление области нажатий.
- В release bundle присутствуют production ID `R-M-19446153-1/-2/-3`; demo ID и `RELEASE_QA` отсутствуют. Основная точка входа восстановлена в `expo-router/entry`.

## Android runtime

Проверено на одном зарегистрированном AVD проекта: `Blockblast_Audio_Check`, Android 10 / API 29, x86_64, 1080×1920. Устройство переиспользовано; данные QA сохранены.

На отладочной сборке с официальными demo-блоками и подготовленной игровой ситуацией:

- Подсказка нажимается, показывает ghost-позицию и событие `helper_funnel: used`.
- Замена нажимается: `sq3` заменяется на `h2`, событие использования подтверждено.
- Кнопка настроек открывает панель; новый слой не блокирует её.
- SDK сообщает **`Yandex Mobile Ads 8.6.0 initialized successfully`** и успешную интеграцию MyTarget. JS `getLibraryVersion()` также возвращает 8.6.0.
- Banner: загрузка и показ подтверждены.
- Interstitial: загрузка, показ, закрытие и возврат в игру подтверждены.
- Rewarded: загрузка и показ подтверждены; **один earned callback**, итог `rewarded`, закрытие и возврат в игру. Попытка показать rewarded во время ещё закрывающегося interstitial корректно вернула `unavailable`.

Из окончательного AAB через bundletool собран набор APK, подписанный тем же release-ключом. Он установлен на этот AVD и успешно запущен без Metro: показан экран обучения, Android подтверждает 1.1.43 / 48; фатальных исключений и ошибок запуска JS нет.

Доказательства находятся в `output/release-1.1.43/`: `sdk-dependency.log`, `qa-events.log`, `native-debug.log`, `release-runtime.log`, `release-launch.png`, `helper-hint-tap.png`, `helper-swap-tap.png`, `hud-settings-tap.png`, `demo-interstitial.png`, `demo-rewarded.png`, `artifact.json`, `jarsigner.log`, `certificate.log`, `manifest.xml`.

Показы трёх форматов проверены на demo inventory в debug; финальный release проверен установкой и запуском. Это не измерение production fill rate или дохода и не проверка всех моделей телефонов. Настройки рекламного кабинета не менялись.

## Команды проверки

Из корня проекта, с Android Studio JBR в PATH:

```powershell
jarsigner -verify -verbose -certs dist/blockblast-1.1.43-vc48.aab
keytool -printcert -jarfile dist/blockblast-1.1.43-vc48.aab
java -jar output/release-1.1.36/bundletool-all-1.18.3.jar validate --bundle=dist/blockblast-1.1.43-vc48.aab
java -jar output/release-1.1.36/bundletool-all-1.18.3.jar dump manifest --bundle=dist/blockblast-1.1.43-vc48.aab --module=base
```

Официальные источники: [Android SDK 8.6.0](https://github.com/yandexmobile/yandex-ads-sdk-android/releases/tag/8.6.0), [интеграция React Native](https://ads.yandex.com/helpcenter/en/dev/react-native/quick-start), [POM адаптера 5.51.2.2](https://repo.maven.apache.org/maven2/com/yandex/ads/mediation/mobileads-mytarget/5.51.2.2/mobileads-mytarget-5.51.2.2.pom).
