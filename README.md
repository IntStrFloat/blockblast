# Блок Бластик! / Block Blastic

Android-головоломка на Expo SDK 56 / React Native: поле 8×8, перетаскивание фигур,
очистка линий, комбо и режим «Путешествие».

Поддерживаемые артефакты приложения — **APK и Android App Bundle (AAB)**.

## Подготовка

- Node.js 22.13+ (или совместимая версия из engines React Native) и JDK 21 (`JAVA_HOME`).
- Android SDK (`ANDROID_HOME`): platform-tools, platforms;android-36,
  build-tools;35.0.0 и build-tools;36.0.0, ndk;27.1.12297006, cmake;3.22.1.
- `npm ci` устанавливает закреплённые зависимости и применяет локальные патчи.

## Сборка APK

```bash
npm ci
npm run build:apk
```

Результат: `dist/blockblast-<version>-vc<versionCode>-local.apk`.
Это автономный release-вариант с локальной debug-подписью и ARM64 ABI: Metro
не нужен, APK можно установить в эмулятор или на ARM64 Android-устройство.
Он не предназначен для обновления опубликованного приложения с release-подписью.

При необходимости другого набора Android ABI:

```bash
npm run build:apk -- --architectures=armeabi-v7a,arm64-v8a
```

## Сборка AAB

```bash
npm run build:aab
```

Результат: `dist/blockblast-<version>-vc<versionCode>-release.aab`.
Команда требует прежние `credentials/release.jks`, `credentials/keystore.properties`,
настоящий `agconnect-services.json` и `APPMETRICA_API_KEY` в `.env.local`.
Она проверяет сертификат опубликованной игры. Ключи и настройки сервисов в Git
не хранятся; новый release-ключ создавать нельзя.

Если нужен неподписанный AAB для локальной проверки:

```bash
npm run build:aab -- --unsigned
```

Результат: `dist/blockblast-<version>-vc<versionCode>-unsigned.aab`.
У AAB сохранён прежний набор ABI: armeabi-v7a, arm64-v8a, x86, x86_64.
Он не является готовым подписанным релизом для магазина.

Обе команды выполняют только Android prebuild и нужную Gradle-задачу, затем
сохраняют артефакт в `dist/`. CMake/C++ задачи React Native, Reanimated, MMKV
и Nitro — внутренние зависимости Android-сборки, отдельного C++-приложения нет.
При отсутствии локальных настроек сервисов APK и явно неподписанный AAB
собираются без активации AppMetrica и конфигурации Huawei; такие сборки подходят
для проверки игры, но не подтверждают работу этих интеграций.

## Проверки

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run backend:test
```

`backend:test` компилирует TypeScript-движок для тестов backend; отдельный клиент
или дополнительный формат сборки приложения при этом не создаётся.

## Эмулятор и документация

Один постоянный эмулятор на игру переиспользуется между фичами, ветками и чатами.
Привязка Block Blastic и команды установки APK: [Android emulator](docs/runbooks/android-emulator.md).

- [Сборка APK/AAB](docs/specs/08-build-release.md)
- [Подпись AAB и однократный PEPK](docs/runbooks/android-app-signing.md)
- [Архитектура и игровые спеки](CLAUDE.md)
- [Материалы для RuStore](store/)

`android/`, `dist/`, `output/`, логи и локальные QA-снимки генерируются локально
и не коммитятся. Исходники игры, её assets, backend и материалы магазина остаются
в репозитории.
