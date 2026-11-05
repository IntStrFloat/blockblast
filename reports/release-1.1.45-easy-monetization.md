# Блок Бласт 1.1.45 / 50 — Простая монетизация

Проверка: 21 октября 2026. Android package: `com.intstrfloat.blockblast`.

## Кабинет и конфигурация

В авторизованном кабинете РСЯ подтверждены активное приложение **20255841**, включённая Простая монетизация и три активных блока. Соответствие форматов проверено непосредственно в интерфейсе:

| Размещение | Формат / production ID | Сценарий и ограничения | Награда |
|---|---|---|---|
| Game | Banner / `R-M-20255841-1` | Отдельная область под треем; после FTUE и двух партий; учитывает removeAds и fullscreen suppression | — |
| Game over / Adventure result | Interstitial / `R-M-20255841-3` | Обычное продолжение между партиями/завершёнными уровнями; без Adventure retry и коротких Classic-партий; сохранены прогрев 6 партий, период 4 завершения, интервал 180 секунд и экспериментальные ограничения | — |
| Classic revive | Rewarded / `R-M-20255841-2` | Добровольная кнопка на результате; одна возможность продолжения исходной партии | Продолжение партии |
| Hint / Swap | Rewarded / `R-M-20255841-2` | Существующий добровольный оффер после расходования доступного помощника | Один заряд соответствующего помощника |
| Adventure XP | Rewarded / `R-M-20255841-2` | Существующее предложение на результате, снимок суммы из receipt завершённого уровня | Дополнительный XP в размере исходного начисления |

Home остаётся без баннера; четвёртый блок не создавался. Старые блоки приложения **19446153** в кабинете сохранены для установленных версий. В `.env.local` обновлены три действующих override по формату. Debug и `EXPO_PUBLIC_YANDEX_TEST_ADS=true` принудительно используют официальные demo ID, независимо от production env.

В RuStore через авторизованную Консоль подтверждён опубликованный релиз **1.1.44 (49)**. Версии app/package/lock/generated Gradle повышены до **1.1.45 (50)**. Загрузка в магазин и изменение rollout не выполнялись.

## SDK и воспроизводимость

Сохранены Expo SDK 56, React Native 0.85.3, Hermes и New Architecture. Npm wrapper — `yandex-mobile-ads` **8.5.0**, фактическая native SDK — **8.6.0**. Подключена единая медиация **8.6.0.0** по [официальной RN-инструкции](https://ads.yandex.com/helpcenter/ru/easy/integration/react-native/integration/mediation).

`withYandexVkMediation` идемпотентно заменяет прямой strict core pin и standalone adapter на единую зависимость; добавляет официальные vendor repositories, включая транзитивные Explorestack/BidMachine и Chartboost OMID. Google APPLICATION_ID и самостоятельный AdMob не добавлялись; сети из рекомендованной сборки не исключались.

Нативная сборка выявила несовместимую Kotlin metadata 2.3 при старом компиляторе 2.1.20. Плагин теперь воспроизводимо задаёт Kotlin **2.3.0** в Gradle properties **и root buildscript classpath**. Expo выбирает KSP **2.3.7**. Минимальные JVM memory limits — heap 6144m / metaspace 1024m; более высокие лимиты и остальные флаги сохраняются. Проверки metadata не подавлялись, runtime SDK не понижались.

Полный resolved graph сохранён в `output/easy-monetization-2026-10-21/bundleRelease-final.log`; компактный список — `resolved-adapters.json` в той же папке. Resolved mediation entries:

| Adapter | Версия |
|---|---|
| AppLovin | 13.6.3.3 |
| AppNext | 2.7.6.473.26 |
| BIGO | 6.1.0.0 |
| Chartboost | 9.14.0.1 |
| Digital Turbine | 8.4.7.1 |
| Google NextGen | 1.3.1.0 |
| InMobi | 11.4.1.1 |
| IronSource | 9.6.0.1 |
| Mintegral | 17.1.81.1 |
| Moloco | 4.12.0.0 |
| myTarget | 5.51.2.2 |
| Pangle | 8.3.0.3.0 |
| Start.io | 5.3.1.3 |
| Unity Ads | 4.20.0.1 |
| Vungle | 7.7.8.1 |
| Zmaticoo | 1.8.5.17 |
| Extras | 8.6.0.0 |

Сохранён исходный banner safety patch. Дополнительно native fullscreen wrapper удаляет завершившийся объект при failed-to-show, чтобы `onAdDeleted` снял JS subscriptions. Загрузчики теперь переиспользуются по одному на формат вместо накопления нового native loader при каждой попытке.

## Выдача наград

Revive и заряды помощников фиксируются непосредственно при `onRewarded`, до dismiss. Журнал сохраняет заработанное обязательство перед применением; повторяется выдача, а не рекламный просмотр. Заряд и receipt помощника записываются атомарно. Повторные callbacks/тапы/восстановление не дублируют начисление. Журнал незавершённого просмотра без earned не даёт награды.

Classic revive привязан к исходной партии; board и reviveUsed фиксируются одной критической записью. Необязательный `leaderboardProofId` сохраняет совместимость старых checkpoints и позволяет восстановить отдельную запись рейтинга после сбоя между записями. Reconciliation не открывает чужой proof. Время полноэкранной рекламы не прибавляется к активному времени продолженной партии. Экономика, Adventure XP, сохранённые платные права и частотные ограничения не менялись.

## Проверки

- Полный Jest на итоговых production-исходниках: **186 suites / 1252 tests passed** (`jest-production-final.log`).
- Backend: **16/16 passed** (`backend-tests.log`).
- TypeScript: passed (`typecheck-final.log`).
- ESLint: 0 ошибок, 1 прежнее предупреждение `seasons.ts:35` (`lint-final.log`).
- `patch-package --error-on-fail`: оба существующих патча успешно применены, включая расширенный Yandex patch (`patch-validation.log`).
- Отдельные регрессии покрывают config/plugin idempotence, home layout, native loader reuse, readiness и banner recovery, earned/dismiss/failure, повторные callbacks/тапы, ошибки хранения, process recovery, proof reconciliation и частотные/entitlement правила.
- Независимая проверка обнаружила и затем подтвердила исправление окна сбоя между revived board и leaderboard proof.

### Реальный Android runtime

Переиспользован единственный зарегистрированный AVD **Blockblast_Audio_Check**, API 29 / x86_64, актуальный serial **emulator-5556**. Устройство не пересоздавалось и не очищалось. Signed APK устанавливались поверх существующего приложения. QA использовал отдельный MMKV-профиль и управляемую игровую fixture: пройденный FTUE, 12 партий и подходящий результат с activeDurationMs=180000. Частотные границы отдельно проверены unit-тестами. Запросы игрового backend были отключены в QA entry, SDK использовал реальную сеть. Исходный player MMKV до/после всех demo-проверок побайтно совпал по SHA-256.

Фактические результаты в `runtime.log` и `runtime-verification.json` (время лога UTC):

- **10:50:43–46**: все три demo-формата загружены; banner показан под полем, rewarded UI доступен. `demo-banner.png`.
- **10:51:39**: helper earned увеличил заряд 0→1 до dismiss. Процесс остановлен до закрытия; после старта **10:52:02** заряд 1 и receipt сохранены.
- Следующая попытка, остановленная сразу после impression до earned, после старта **10:54:51** сохранила прежний баланс 1 и не оставила earned-обязательства.
- **10:56:56–10:58:24**: обычная кнопка replay на результате после отказа от доступного revive-предложения вызвала interstitial. Реальные shown/dismissed, затем новая партия. `demo-interstitial.png`, `game-after-interstitial.png`.
- **10:59:27**: revive применён до dismiss; немедленная остановка процесса. После восстановления партии **11:00:12**: playing, reviveUsed=true, исходный runId. `revived-after-restart.png`.
- **11:01:08**: без сети все три формата вернули network error code 3; игра осталась управляемой. Связь возвращена **11:02:03**. На том же экране и в том же процессе **7447** banner/rewarded загружены **11:02:39**, кнопки снова доступны; rewarded loader создан один раз. `offline-game.png`, `network-recovered.png`.
- Дополнительный реальный ход при отключённой сети: **11:03:27**, score 426→1717, очищено 14 линий; игровой переход не ждал рекламу.

Закрытие без earned, duplicate callbacks и failed-to-show дополнительно проверены поведенческими автоматическими тестами. Native прерывание до earned проверено остановкой процесса; стандартный demo-креатив не предоставлял раннюю кнопку закрытия.

### Production — только загрузка

Отдельный signed load-only probe с тем же package и SDK использовал новые production ID и `testAds=false`. Banner находился в невидимом контейнере, fullscreen show не вызывался. В **11:05** rewarded и interstitial загрузились; banner получил штатный no-fill code 4. При одном контрольном повторе **11:06:32–38** успешно загрузились **все три production-формата**. Production impressions, show и clicks не создавались; `UNEXPECTED_IMPRESSION` отсутствует. После проверки probe остановлен.

## app-ads.txt

Публичный URL: [https://bloxx.193.160.208.95.nip.io/app-ads.txt](https://bloxx.193.160.208.95.nip.io/app-ads.txt).

Ответ: **200 / text/plain / 124152 bytes**. SHA-256: `8e96a38e044e5e22d94dabdc81ee344b676f37cf7366c4a61c8cf14bcff690a1`, побайтно совпадает с предоставленным `gostlix10 (1).txt`, включая Google seller-строки. Файл сохранён в `backend/deploy/app-ads.txt`; `.gitattributes` запрещает изменение переводов строк.

До исправления URL отдавал SPA index.html. На действующий Bloxx host добавлены только точный nginx route и файл. `nginx -t` успешен; site index и backend server.cjs сохранили прежние hashes, API health 200, backend service active. Rollback конфигурации: `/var/lib/bloxx/rollback-app-ads-20261021/nginx.conf`. Другие проекты не изменялись.

В опубликованных Contacts карточки виден email, но связь developer website с этим доменом не отображается. Индексация seller-файла сетями и ассоциация домена отдельно **не подтверждены**; доступный HTTPS URL сам по себе их не доказывает.

## Изменённые файлы этой интеграции

- `plugins/withYandexVkMediation.js` и тесты; `src/features/monetization/config.ts` и тесты; три ad ID в игнорируемом `.env.local`.
- `yandexAds.native.ts`, `rewardedBenefits.ts`, native patch `patches/yandex-mobile-ads+8.5.0.patch` и связанные регрессии.
- `core/storage/index.ts`, `core/engine/serialize.ts`, game store / GameOverOverlay, leaderboard store, mascot store/types / HelperHint / HelperSwap, startup recovery в `app/_layout.tsx` и тесты.
- `app.json`, `package.json`, `package-lock.json`; retained generated Gradle синхронизирован через helpers плагина и существующий signing patch.
- `backend/deploy/nginx-bloxx.conf`, `backend/deploy/app-ads.txt`, `.gitattributes`, исключение локальных QA-артефактов в `.gitignore`, этот отчёт.

Существовавшие до начала задачи незакоммиченные исправления рекламы/игры сохранены. Упрощения: одна mediation dependency вместо дублирования native core/adapter; один loader на формат; общая идемпотентная выдача revive/helper.

## Итоговый артефакт

- Файл: `C:/Users/Dima2/Documents/blockblast/dist/blockblast-1.1.45-vc50.aab`.
- Версия: **1.1.45 / versionCode 50**, package **com.intstrfloat.blockblast**.
- Размер: **121068123 bytes** (115.46 MiB).
- SHA-256: **0C15620E11EDF8AEB6EA61247C26FEC79A62612354B16D0C6966CA7CD5EC6D49**.
- Сертификат SHA-256: **74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3**. Совпадает с предыдущим AAB 1.1.44 / 49 и существующим release key.
- `:app:bundleRelease :app:dependencies --configuration releaseRuntimeClasspath --rerun-tasks --max-workers=2 --console=plain -I ../.omx/release-build.init.gradle`: **BUILD SUCCESSFUL, 35m44s, 823/823 tasks executed**.
- `jarsigner -verify -verbose -certs`: exit 0, **jar verified**; ожидаемые предупреждения self-signed / timestamp. `keytool -printcert -jarfile`: ожидаемый fingerprint. `bundletool validate`: exit 0. Логи: `jarsigner.txt`, `certificate.txt`, `previous-certificate.txt`, `bundletool-validate.txt`.
- Все четыре ABI: **arm64-v8a, armeabi-v7a, x86, x86_64**; minSdk 24 / targetSdk 36 / debuggable=false.
- Проверены embedded Hermes bundle и source map: три новых production ID присутствуют; старые используемые ID, demo ID, QA entry, load-only probe, временный storage ID и backend override отсутствуют. `base/assets/index.android.bundle` побайтно равен проверенному production bundle. Доказательство: `artifact-verification.json`.
- APK-набор сгенерирован **из этого AAB**, подписан существующим ключом и установлен поверх текущего приложения без uninstall/clear-data. Хеши исходного MMKV до и после установки совпали. `install-release.log`, `player-before-final-install.txt`, `player-after-final-install.txt`.
- Холодный запуск: **Status ok / COLD / 4057 ms**. Установлено 1.1.45 / 50 без DEBUGGABLE; отрисован обычный FTUE исходного профиля, QA-код не выполняется. Нет FATAL EXCEPTION или ошибок ReactNativeJS. `release-launch.log`, `installed-package.txt`, `release-cold.log`, `release-cold-launch.png`.

Все перечисленные журналы, JSON и изображения находятся в `C:/Users/Dima2/Documents/blockblast/output/easy-monetization-2026-10-21/`. Локальные QA-артефакты и резервная копия профиля исключены из Git.

После проверки временные MMKV-файлы QA удалены; исходный профиль сохранён. На AVD оставлена production-версия из финального AAB. Устройство штатно остановлено без wipe, отсутствие процесса/device подтверждено, testing owner освобождён в реестре.

## Практические пределы

Demo runtime подтверждает технический поток, production load — работоспособность запросов действующих блоков. Доход, fill rate каждой сети и индексация app-ads.txt не измерялись. No-fill возможен и при корректной интеграции. Локальное восстановление не может доказать earned, если процесс погиб до первой успешной записи earned-события; серверной верификации наград эта миграция не добавляет.

Для выпуска рекомендован постепенный rollout с наблюдением за ошибками, показами и удержанием; примерно две недели оставить на обучение медиации, согласно предоставленной рекомендации менеджера. Это рекомендация, без обещания определённого дохода. Публикация пользователем выполняется отдельно.
