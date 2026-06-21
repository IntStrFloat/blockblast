# 08 — Сборка и релиз (AAB, RuStore)

Статус: утверждено · Обновлено: 2026-06-15

## Пайплайн (локальный, без EAS — проверен на прошлом RuStore-релизе)

1. `npx expo prebuild --platform android` — генерация `android/` (CNG; папка в .gitignore, источник истины — app.json + plugins).
2. JDK: **JBR 21** (`C:\Program Files\Android\Android Studio\jbr`) через `JAVA_HOME` на время сборки. Android SDK: `%LOCALAPPDATA%\Android\Sdk` (local.properties генерится).
3. Release keystore: `credentials/release.jks` — **только локально, в .gitignore, обязателен бэкап**. Это ключ уже опубликованной версии: его нельзя генерировать заново или заменять. Пароли — в `credentials/keystore.properties` (тоже в .gitignore).
4. Подпись: signingConfig в `android/app/build.gradle` подхватывается из `keystore.properties` (патчится скриптом `scripts/patch-signing.js` после prebuild, чтобы prebuild оставался воспроизводимым).
5. Сборка: `cd android && .\gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.
6. Для публикации используется подписанный AAB. `assembleRelease` допустим только для отдельного локального APK-теста.
7. PEPK и сертификат загрузки: [docs/runbooks/android-app-signing.md](../runbooks/android-app-signing.md).

## RuStore maven (push SDK) — TLS truststore

Нативный AAR push-SDK (`ru.rustore.sdk:pushclient`) тянется из maven RuStore
`https://artifactory-external.vkpartner.ru/artifactory/maven`. Его TLS-сертификат
(издатель HARICA CA) отсутствует в truststore JBR → `gradlew` падает с
`PKIX path building failed` (curl/OS сертификату доверяют, Java — нет). Варианты:

- **Разово (рекомендуется):** импортировать сертификат в `cacerts` JBR —
  `keytool -importcert -trustcacerts -keystore "$JAVA_HOME\lib\security\cacerts" -storepass changeit -alias rustore-artifactory -file rustore.pem`
  (сертификат: `echo | openssl s_client -connect artifactory-external.vkpartner.ru:443 | openssl x509 -outform PEM > rustore.pem`).
- **Без правки JBR:** собрать копию `cacerts` + этот сертификат и передать сборке
  `GRADLE_OPTS="-Djavax.net.ssl.trustStore=<copy> -Djavax.net.ssl.trustStorePassword=changeit"` (с `--no-daemon`).

Требуется при любой версии RuStore push SDK (npm и GitFlic). См. [16-push-notifications.md](16-push-notifications.md).

## app.json (ключевое)

- `android.package`: `com.intstrfloat.blockblast`
- `versionCode` — инкремент на каждый аплоад в RuStore (vc1 = 1.0.0).
- `orientation: portrait`, `userInterfaceStyle: dark` (игра тёмная всегда).
- `predictiveBackGestureEnabled: false` (жесты игры).

## Чек-лист RuStore (из опыта прошлой модерации)

- [ ] Политика конфиденциальности: публичный URL обязателен (хостим `privacy.html` на сервере проекта — 186.246.12.198; деплой см. ниже).
- [ ] Нет мёртвых фич/кнопок-заглушек на экранах (причина прошлого реджекта другого проекта!). Кнопки IAP при `iapEnabled:false` — скрыты, не «недоступно».
- [ ] Тексты стора: название, короткое/полное описание, скриншоты (5+), иконка 512.
- [ ] Возрастной рейтинг 0+/6+, категория «Головоломки».
- [ ] Данные: приложение оффлайн, аналитики нет, разрешений нет (кроме VIBRATE) — анкета приватности простая.

## Сервер проекта

`186.246.12.198` — статический хостинг политики (`/privacy.html`, порт 80/8088 по факту окружения). Креды — у владельца, в репо не хранятся. Деплой: scp файла, один раз.

## CI-замечание

Сборка локальная по решению проекта (история: EAS не использовался). Если понадобится CI — GitHub Actions с ubuntu + `expo prebuild` + gradle, keystore в secrets.

## Версии

| Артефакт | Версия |
|---|---|
| v1.0.0 (vc1) | первый APK: core loop, монетизация флагами OFF |
