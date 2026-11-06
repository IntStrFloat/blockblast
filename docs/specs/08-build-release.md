# 08 — Android: APK и AAB

Обновлено: 2026-11-05.

Источник конфигурации — `app.json`, config plugins и закреплённые зависимости.
Сгенерированный `android/` в Git не хранится. Единственные форматы приложения:
APK и AAB. iOS/web-целей и отдельной C++-сборки нет.

## Команды

| Команда | Результат |
|---|---|
| `npm run build:apk` | автономный ARM64 release APK с локальной debug-подписью |
| `npm run build:aab` | AAB с прежней release-подписью для магазина |
| `npm run build:aab -- --unsigned` | неподписанный AAB для локальной проверки |

Артефакты: `dist/blockblast-<version>-vc<versionCode>-local.apk`,
`dist/blockblast-<version>-vc<versionCode>-release.aab` или `*-unsigned.aab`.
Версия берётся из `app.json`; локальная пересборка не меняет versionCode.
Перед новым store upload версию и versionCode нужно увеличить согласованно
в app.json, package.json и корневых записях package-lock.json.

## Среда

Node.js 22.13+ (или совместимая версия из engines React Native), JDK 21 через JAVA_HOME, Android SDK через ANDROID_HOME.
Для текущей версии нужны platforms;android-36, build-tools;35.0.0 и build-tools;36.0.0,
ndk;27.1.12297006 и cmake;3.22.1. На macOS SDK по умолчанию берётся из
`~/Library/Android/sdk`, на Windows — `%LOCALAPPDATA%/Android/Sdk`.
Шаблон prebuild закреплён на expo-template-bare-minimum@56.0.38. Патч
@react-native/gradle-plugin обновляет Foojay resolver до 1.0.0 для Gradle 9;
без него чистая сборка падает на удалённом IBM_SEMERU.
RuStore Maven и его зависимость Tracer используют новые Nexus-адреса RuStore/VK,
перед JitPack, чтобы его HTTP 401 не блокировал поиск зависимостей.
После `npm ci` команды сами делают Android prebuild, записывают local.properties,
применяют signing patch и запускают только assembleRelease или bundleRelease.

Нативные CMake/C++ задачи RN, Nitro, MMKV и Reanimated остаются необходимой
частью Android-компиляции. APK по умолчанию ARM64 для постоянного эмулятора;
AAB сохраняет совместимость с четырьмя прежними Android ABI. Набор можно явно
передать через `--architectures=armeabi-v7a,arm64-v8a`.

## Локальная проверка без production-настроек

APK использует существующий debug keystore сгенерированного Android-проекта.
Unsigned AAB вообще не подписывается. Новый release keystore не создаётся.
Если нет APPMETRICA_API_KEY или agconnect-services.json, локальная команда
явно отключает соответствующую активацию/конфигурацию и выводит предупреждение.
Настоящие значения не заменяются фиктивными. Это не проверка аналитики или Huawei.

Для APK не нужен Metro. Установка в постоянный эмулятор:
[android-emulator.md](../runbooks/android-emulator.md).

## Релиз в магазин

Нужны прежние credentials/release.jks и credentials/keystore.properties,
agconnect-services.json нужного Android package и APPMETRICA_API_KEY в .env.local.
Подписанный режим не допускает отсутствующих настроек или локальной подписи.
Команда проверяет ожидаемый сертификат AAB; ключ нельзя генерировать заново.
Подпись, fingerprint и однократное подключение PEPK:
[android-app-signing.md](../runbooks/android-app-signing.md).

## Проверки и хранение

`npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, `npm run backend:test`.
Дополнительно проверить подпись APK/AAB, package/version из готового артефакта,
установить APK и пройти начало игры на Android. Для unsigned AAB подтвердить
отсутствие JAR-подписи. APK/AAB, Gradle/CMake-вывод, бандлы, логи и скриншоты
не коммитить; в Git остаются исходники и поддерживаемая документация.

Если Java не доверяет TLS цепочке Maven RuStore, исправить доверенные CA в
отдельном локальном truststore и указать его JVM. Не отключать проверку TLS и
не коммитить truststore. Исторические отчёты описывают прошлые версии; их команды
не заменяют текущие build:apk / build:aab.
