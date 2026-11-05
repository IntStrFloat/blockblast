# Bloxx 1.1.44 / versionCode 49 — восстановление рекламы

Дата проверки: 14 октября 2026.

## Исправления

- Отказ от доступного rewarded-предложения больше не запрещает interstitial и не запускает паузу 180 секунд. Маркер предложения очищается без записи показа. Реальная пауза после полноэкранной рекламы, частотные ограничения, исключение коротких партий и ограничения эксперимента сохранены.
- Межстраничная реклама заранее загружается на подходящем экране результата. Раньше после разделения инициализации и загрузки не было вызывающего кода для подготовки первого показа. Предзагрузка проверяет те же ограничения; кнопка продолжения не ждёт сеть.
- Доступность игрового баннера пересчитывается при начале новой партии. Повторные игры в том же экране теперь открывают баннер после достижения порога; геометрия поля посреди партии не меняется.
- Rewarded после ошибки загрузки получает ограниченные повторы через 30 и 60 секунд. Выход с экрана и фон отменяют таймеры; возвращение даёт новый ограниченный цикл с минимальным интервалом между запросами.
- Первая неудачная загрузка баннера также восстанавливается ограниченными повторами. Уже загруженный баннер не пересоздаётся при возврате в приложение или ошибке автообновления SDK.
- Нативный патч обёртки Yandex сохраняет BannerAdView после ошибки, проверяет размеры до удаления дочерних View. Ошибки Android читаются из вложенного `nativeEvent.error`, поэтому аналитика содержит код и описание.
- Metro исключает генерируемые сборки и образ эмулятора из обхода файлов: устранено зависание Windows FallbackWatcher на артефактах.

В сборку также входят ранее выполненные исправления зоны нажатия кнопок Капи и обновление нативного Yandex Mobile Ads SDK до **8.6.0**. Версия npm-обёртки `yandex-mobile-ads` — **8.5.0**, нативная версия закреплена Gradle-плагином; это разные пакеты.

## Основные изменённые файлы

- `src/features/monetization/rewardedOfferPolicy.ts`, `placementPolicy.ts`, `interstitialExperiment.ts`, `config.ts`, `frequency.ts`, `src/features/analytics/types.ts` — политика отказа и аналитика.
- `src/features/monetization/useInterstitialPreparation.ts`, `src/features/game/components/GameOverOverlay.tsx`, `src/app/adventure-level.tsx` — подготовка interstitial.
- `src/features/monetization/useGameBannerEligibility.ts`, `src/app/game.tsx` — доступность баннера между партиями и зона кнопок Капи.
- `src/features/monetization/useRewardedReady.ts`, `useBannerRecovery.ts`, `AdBanner.native.tsx`, `bannerLoadError.ts` — восстановление загрузки.
- `patches/yandex-mobile-ads+8.5.0.patch`, `plugins/withYandexVkMediation.js` — нативный баннер и SDK.
- `metro.config.js`, `app.json`, `package.json`, `package-lock.json`, локальный `android/app/build.gradle` — сборка и версия.
- Соответствующие регрессионные тесты в `__tests__`.

Упрощение: удалены проверки отказа от rewarded из двух уровней политики. Существующая система ограничений и интерфейс рекламного провайдера переиспользованы; новые зависимости не добавлялись.

## Проверки

- Полный Jest: **185 suites, 1225 tests passed** (`output/release-1.1.44/jest-final.log`).
- Backend: **16/16 passed** (`backend-final.log`).
- TypeScript: passed (`typecheck-final.log`); после финального изменения hook повторная проверка агентом также passed.
- Lint: 0 ошибок, 2 прежних предупреждения в `seasons.ts` и `mascot/logic/types.ts` (`lint-final.log`); новые файлы проходят scoped ESLint.
- 13 поведенческих тестов восстановления баннера: ограничение повторов, отмена в фоне/при подавлении, возврат после исчерпания попыток, сохранение загруженного экземпляра, ошибка автообновления.

Нативные проверки выполнены на единственном зарегистрированном Bloxx AVD `Blockblast_Audio_Check`, API 29, x86_64. Использовалась debug-сборка с теми же нативными зависимостями, demo-ID Яндекса и управляемым игровым состоянием. Подмена рекламных ID и QA entry удаляются перед production-сборкой.

### Отказ от rewarded → interstitial

В `policy-runtime.log` (время UTC):

- 15:46:57: показано доступное предложение revive, запрошена предзагрузка interstitial.
- 15:47:01: interstitial загружен.
- 15:47:46: нажата обычная кнопка replay, политика возвращает `request`.
- 15:47:48: зарегистрирован реальный SDK `ad_shown` interstitial.

Скриншоты: `reward-offer-before-decline.png`, `interstitial-after-decline.png`. Рекламные объявления не нажимались.

### Потеря сети → восстановление без смены экрана

Финальный запуск, процесс Android 6941, `network-verified.log` (UTC):

- 15:55:09: banner и rewarded получают сетевую ошибку SDK code 3.
- Сеть включена, приложение остаётся на том же игровом экране.
- 15:55:39: оба формата повторяют запрос через 30 секунд.
- 15:55:52: баннер загружен и показан (`ad_loaded`, `ad_shown`).
- 15:56:02: rewarded загружен; предложения подсказки и замены снова доступны.

Скриншот: `network-recovered-final.png`. Отдельно проверен возврат из фона после исчерпания всех offline-попыток (`network-final-foreground.log`).

## Артефакт и подпись

- Файл: `C:/Users/Dima2/Documents/blockblast/dist/blockblast-1.1.44-vc49.aab`.
- Размер: **90 993 412 байт** (86,78 MiB).
- SHA-256: `21A5311F3F2DFC4E868CECD8B96C6257E987AA9C419005D7ED5242481698580B`.
- Сертификат SHA-256: `74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3` — совпадает с существующим release-ключом.
- `bundleRelease --rerun-tasks --max-workers=2 --console=plain -I ../.omx/release-build.init.gradle`: **BUILD SUCCESSFUL**, 822/822 tasks executed, 27m53s (`release-build.log`).
- `jarsigner -verify -verbose -certs dist/blockblast-1.1.44-vc49.aab`: exit 0, **jar verified** (`jarsigner.txt`). Есть предупреждения JBR о self-signed сертификате, отсутствии timestamp и различии ZIP-entry-order при JarInputStream; проверка JarFile и bundletool успешна.
- `keytool -printcert -jarfile dist/blockblast-1.1.44-vc49.aab`: exit 0, ожидаемый сертификат (`certificate.txt`).
- `java -jar output/release-1.1.36/bundletool-all-1.18.3.jar validate --bundle=dist/blockblast-1.1.44-vc49.aab`: exit 0 (`bundletool-validate.txt`).
- Manifest: `com.intstrfloat.blockblast`, **1.1.44 / 49**, debuggable=false, minSdk=24, targetSdk=36. ABI: arm64-v8a, armeabi-v7a, x86, x86_64.
- Gradle `:app:dependencyInsight --dependency com.yandex.android:mobileads --configuration releaseRuntimeClasspath` подтвердил единственную выбранную версию **8.6.0**, включая совместимое требование MyTarget adapter 5.51.2.2 (`yandex-dependency.txt`).
- Содержимое AAB: байты JS-бандла совпадают с проверенным production-бандлом; три production-ID присутствуют, demo-ID и QA entry отсутствуют. Новые hooks и политика v3 входят в source map (`artifact-verification.json`).

APK-набор, полученный **из этого AAB** через bundletool, успешно установлен поверх тестового приложения с тем же release-сертификатом без uninstall/clear-data. Перед установкой исходный профиль MMKV восстановлен из сохранённой копии и проверен побайтно. ADB reverse удалён, Metro остановлен. Холодный запуск: `Status: ok`, `LaunchState: COLD`, 4934 ms. Android подтверждает 1.1.44 / 49 без DEBUGGABLE; игровой экран отрисован. В журнале запуска нет `FATAL EXCEPTION` или ошибок ReactNativeJS. Доказательства: `install-release.log`, `release-launch.log`, `release-cold-launch.png`.

Все журналы и изображения в этом отчёте находятся в `C:/Users/Dima2/Documents/blockblast/output/release-1.1.44/`. Файл подготовлен для загрузки в магазин; публикация в магазин не выполнялась.

## Практические ограничения

Исправления устраняют найденные причины потери показов в коде, но не гарантируют заполнение рекламной сети или рост дохода. Проверки сетевых сценариев использовали demo-рекламу. Если игрок мгновенно продолжает игру до завершения предзагрузки interstitial, переход остаётся быстрым и показ может быть пропущен. Повторы намеренно ограничены; при длительном отсутствии сети новый цикл запускается после возвращения в приложение/повторного появления предложения. Проверены Android API 29 и существующие автоматические тесты, не весь парк устройств.
