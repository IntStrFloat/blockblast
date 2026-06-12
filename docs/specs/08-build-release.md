# 08 — Сборка и релиз (APK, RuStore)

Статус: утверждено · Обновлено: 2026-06-12

## Пайплайн (локальный, без EAS — проверен на прошлом RuStore-релизе)

1. `npx expo prebuild --platform android` — генерация `android/` (CNG; папка в .gitignore, источник истины — app.json + plugins).
2. JDK: **JBR 21** (`C:\Program Files\Android\Android Studio\jbr`) через `JAVA_HOME` на время сборки. Android SDK: `%LOCALAPPDATA%\Android\Sdk` (local.properties генерится).
3. Release keystore: `credentials/release.jks` — **только локально, в .gitignore, обязателен бэкап**. Генерация: `keytool -genkeypair -v -keystore credentials/release.jks -alias blockblast -keyalg RSA -keysize 2048 -validity 10000`. Пароли — в `credentials/keystore.properties` (тоже в .gitignore).
4. Подпись: signingConfig в `android/app/build.gradle` подхватывается из `keystore.properties` (патчится скриптом `scripts/patch-signing.js` после prebuild, чтобы prebuild оставался воспроизводимым).
5. Сборка: `cd android && .\gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`.
6. Для RuStore нужен APK (не AAB) — `assembleRelease` это и даёт.

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
