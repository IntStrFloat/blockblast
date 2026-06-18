# Bloxx — Block Blast clone (Expo React Native)

Клон Block Blast: доска 8×8, drag-n-drop фигур без вращения, очистка строк и столбцов,
комбо и серии. Полностью оффлайн, без регистрации. Android (RuStore) + iOS.

## Документация

Вся архитектура и решения — в спеках: см. индекс в [CLAUDE.md](CLAUDE.md)
(анализ оригинала, экраны, архитектура, движок, дизайн-система, монетизация,
ЦА Gen Z/Alpha, производительность, сборка/релиз — `docs/specs/00..08`).
Тексты для RuStore и политика: [store/](store/).

## Быстрый старт

```bash
npm install
npm test              # 100 тестов (движок, сторы, логика)
npx tsc --noEmit
npx expo start        # dev-сервер (нужен dev-client: в проекте mmkv/nitro, Expo Go не подойдёт)
```

## Сборка release AAB (Windows, локально)

```powershell
node scripts/gen-assets.js                  # иконки/сплеш (если менялись)
npx expo prebuild --platform android
node scripts/patch-signing.js               # подпись из credentials/keystore.properties
'sdk.dir=C:\\Users\\<user>\\AppData\\Local\\Android\\Sdk' | Set-Content android\local.properties -Encoding ascii
cd android
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'   # JDK 21
.\gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Keystore: `credentials/release.jks` + `credentials/keystore.properties` — не в git,
**обязательно сделать бэкап** (без него не обновить приложение в сторе).
PEPK и проверка подписи: `docs/runbooks/android-app-signing.md`.

## Структура

```
src/core/engine        — чистый TS-движок (правила, скоринг, RNG, сериализация)
src/core/{storage,i18n}— MMKV-обёртка, словари ru/en (2 тона похвал)
src/features/game      — доска/трей/drag (worklets), эффекты, звук, стор партии
src/features/*         — settings, scores, streak, share, monetization (за флагами)
src/ui                 — токены, темы блоков, AppText, примитивы
src/app                — expo-router: Home / Game / Settings
```

Монетизация (Yandex Ads + RuStore Billing) спроектирована и выключена флагами —
включение без правки кода экранов: `docs/specs/05-monetization.md`.
