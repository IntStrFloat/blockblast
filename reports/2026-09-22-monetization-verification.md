# Проверка изменений монетизации — 22.09.2026

## Что сделано
- Исследование открытых источников и сравнение Woodoku, Blockudoku, Block Blast: [обоснование](2026-09-22-monetization-design.md).
- Текущая реализация разобрана по реальным исходникам и SDK; исходная диагностика: [eCPM](2026-09-22-ecpm-investigation.md).
- Политика contextual-breaks-v1: Adventure retry без interstitial; классика — минимум 120 секунд активной партии; видимый rewarded защищает этот результат от interstitial даже после повторного открытия. После отказа/просмотра 90 секунд без автоматической рекламы.
- Добровольный бонус на обычном первом результате Adventure: ещё базовые 500/650 XP. Обычный XP бесплатен. Финальный уровень сезона исключён. Отдельные entitlement/receipt, earned journal, повторная обработка сохранённого подтверждения без повторного просмотра.
- Общий fullscreen lock, скрытие баннеров на результатах/паузах/при fullscreen/защитном интервале; защита быстрых повторных нажатий и аппаратного Back.
- Контекстный ad_revenue с суммой, валютой, сетью, точностью и версией политики. SDK payload баннера проверен по Kotlin/Swift и нормализован вопреки ошибочному .d.ts.
- Старые группы interstitial-first-session-v1 сохранены. Новая политика — общая смена поведения, не новый причинный A/B-тест. Новые события имеют config_version=contextual-monetization-1 и/или policy_version=contextual-breaks-v1.

## Проверено
| Проверка | Доказательство |
|---|---|
| Вся Jest suite | 179 наборов, 1170 тестов, все прошли; [лог](2026-09-22-monetization-tests.log) |
| TypeScript | npm run typecheck, exit 0 после удаления временного QA-экрана |
| ESLint | npm run lint, exit 0; только 2 прежних предупреждения в seasons.ts и mascot/logic/types.ts; новых предупреждений нет |
| Whitespace/static diff | git diff --check по затронутым модулям: exit 0 |
| Android native debug | :app:assembleDebug, BUILD SUCCESSFUL, 526 задач, четыре ABI; [лог](2026-09-22-monetization-android-build.log) |
| Android JS/Hermes export | expo export --platform android: exit 0; entry-4f1cdf306b6f3dac46a8dbed77e51124.hbc, 6.2 MB; [лог](2026-09-22-monetization-android-export.log). Проверочный export использует demo ad units и тестовую конфигурацию, не предназначен для публикации |
| Визуальная проверка | Реальный LevelResultView в браузере на 360×640 и 320×568; обе кнопки и сумма доступны; verdict 94/100, pass |
| Подтверждённый просмотр (эмуляция SDK) | На странице: 500 XP → нажатие rewarded → Next/Exit заблокированы → earned+dismiss → «Бонус XP получен» → Next показывает 1000 XP |
| Закрытие без earned (эмуляция SDK) | 500 XP → dismiss → обычный Next работает, остаётся 500 XP |
| Недоступная реклама (эмуляция SDK) | Rewarded CTA скрыт, базовые 500 XP и бесплатное Next доступны |
| Screen integration | Реальный evaluator+frequency+storage: retry без ad; offer→Next без ad; busy блокирует Next/Exit; старый bonus tap отвергнут; обычная подходящая победа вызывает ровно 1 ad/1 persisted impression |
| Reward robustness | Earned до dismiss; callback/тап дубли; неизвестный показ без earned; grant/первичная запись/cleanup ошибки; восстановление из disk-only pending; базовый receipt и соревновательные состояния не меняются; reveal начинается после dismiss |
| SDK edge | Реальные формы ILRD, malformed/нулевые значения, banner refresh, dedupe fullscreen; синхронный show throw; earned после него не теряется при последующем fail; потерянный impression callback не снимает защиту после rewarded dismissal |

Визуальная проверка использовала временный src/app/monetization-qa.tsx с явной эмуляцией рекламного края, настоящим progression store и компонентом результата. Файл удалён; он не входит в итоговый код. Сервер превью остановлен, viewport восстановлен. Production-рекламу не запрашивали и не кликали для тестов.

## Изменённые области
- src/features/monetization/placementPolicy.ts, interstitialExperiment.ts, rewardedOfferPolicy.ts, adPresentation.ts, config.ts, frequency.ts — правила контекста и защитные интервалы.
- src/features/monetization/adventureXpBonus.ts, src/features/adventure/components/AdventureXpBonus.tsx, LevelResultView.tsx — журнал, выдача и UI бонуса.
- src/features/monetization/yandexAds.native.ts, AdBanner.native.tsx, revenue.ts, types.ts, noop.ts — callbacks, арбитраж, ILRD.
- src/app/adventure-level.tsx, game.tsx, _layout.tsx, src/features/game/components/GameOverOverlay.tsx, src/features/monetization/game-banner-dock.tsx — интеграция, навигация, восстановление.
- src/core/storage/index.ts, src/core/i18n/ru.ts и en.ts, src/features/analytics/types.ts и store.ts — новые ключи, переводы и аналитический контракт.
- Новые/расширенные тесты в monetization/__tests__, adventure/__tests__, game/__tests__, app/__tests__/adventureMonetization.test.tsx.

Сохранён existing progression grantReward вместо второй экономики/баланса; единый арбитраж заменяет разрозненные допущения о fullscreen; повторная обработка наград использует тот же entitlement. Новых зависимостей нет. В workspace до задачи уже были многочисленные незакоммиченные изменения: общий git diff не равен только этой задаче, чужие изменения не откатывались.

## Пределы проверки и последующее измерение
Реальная доставка тестовой рекламы SDK на Android-устройстве не прогонялась: native сборка и JS-export не доказывают сетевой runtime; браузерный сценарий явно эмулировал SDK. Это остаётся проверкой перед магазинным выпуском, который в эту задачу не входил. Публикация, versionCode, signing identity и настройки рекламного кабинета не менялись.

Локальная защита не восстанавливает подтверждение, если процесс умер до первой успешной записи earned. Если SDK не присылает ни одного terminal callback, lock не освобождается небезопасным таймером; приложение требуется перезапустить. Эти ограничения не выдаются за серверную гарантию.

Рост eCPM и общего дохода ещё не доказан. После выпуска сравнивать D7 доход на всех сопоставимых игроков, D1/D7 retention, выходы после рекламы, eCPM/число показов/доход на DAU по формату и placement. Не объединять валюты и policy/config/build версии. Не включать demo-* units в денежные отчёты. Из суммы ad_revenue нельзя делать финансовую сверку без учёта precision, coverage и финальных сумм РСЯ.

Для interstitial ILRD содержит experiment_id/variant/result_context_id/load_id; остальные форматы можно соединить со стабильным назначением по installation_id из экспорта. Не использовать старые сводки scripts/analytics/interstitial-experiment-g17.sql по всей истории без ограничения версии/даты: после этой задачи обе старые группы получили новую placement policy. Сравнение до/после отражает также смену спроса и аудитории, а не только эффект механики.
