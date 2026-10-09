# Визуальная правка после G01–G18

Цель: меньше поясняющих абзацев, больше места для игры и визуальных наград. Основание — скриншот результата 1002: начисление XP, рост уровня и один остаток до награды повторялись четырьмя строками.

Изменения внесены в интерфейс. Сохранения, начисления, правила игры, рекламная политика и события удержания сохранены. Новые зависимости не добавлены, Android-версия не повышалась и магазинная сборка не создавалась.

## Что изменено

| Область | Результат |
|---|---|
| Classic result | Один крупный счёт; отдельный рекорд показывается компактно только когда отличается; короткий заголовок; действия учитывают нижнюю безопасную область и доступны при прокрутке |
| Прогресс награды | Один +XP, номер уровня, полоса до конкретного предмета и его настоящее изображение; название/остаток открываются нажатием, полное описание доступно скринридеру |
| Повышение уровня | Компактное уведомление с реальной наградой, без полноэкранного затемнения и перехвата Next; в Classic независимо от видимости маскота |
| Home | Короткая цель с предметом, одной шкалой/значением; длинное описание убрано с экрана; обработчики продолжения/выбора режима сохранены |
| Adventure | Тип цели обозначен иконкой, одно current/target и полоса; полёты заканчиваются у нового измеренного счётчика; на победе мозаика и награда вместо повторных объяснений |
| Поражение Adventure | Фактический результат и шкала, Retry/Exit; совет по запросу; бесплатная помощь остаётся отдельным явным выбором при соответствующей eligibility |
| Карта | Изображения наград в узлах, одно представление XP, читаемая кнопка «Надеть» |
| Капи / гардероб | Реальные предметы и lock/check по каждому слоту; сокращён заголовок; удалены сводки stage/max/next и одинаковые «получено»; неполученные legacy без способа открытия скрыты, заработанные сохранены |
| Рейтинг | Короткий заголовок, одна цель со шкалой; в пустом offline-состоянии один статус и Retry; ошибки получения конкретного приза сохранены |
| Настройки / профиль | Короткие нужные настройки сохранены; исправлены переносы темы и заголовка профиля; один Close; действия профиля на 320px не обрезаются |
| Подсказки управления | Короткие сообщения «Клетки заняты», «Освободи место другой фигурой», «Попробуй эту фигуру»; пороги, throttle и условия показа сохранены |
| Лоток | Масштаб синхронизируется при смене фигуры/геометрии; изображение центрируется независимо от увеличенной области касания; вертикальный зазор учитывает внутреннюю рамку; активный drag и координаты drop защищены регрессиями |

## Изменённые продуктовые файлы

- [RewardProgressSummary.tsx](C:/Users/Dima2/Documents/blockblast/src/features/progression/components/RewardProgressSummary.tsx), новый [RewardVisual.tsx](C:/Users/Dima2/Documents/blockblast/src/features/progression/components/RewardVisual.tsx).
- [GameOverOverlay.tsx](C:/Users/Dima2/Documents/blockblast/src/features/game/components/GameOverOverlay.tsx), [ReviveButton.tsx](C:/Users/Dima2/Documents/blockblast/src/features/game/components/ReviveButton.tsx), [TutorialHints.tsx](C:/Users/Dima2/Documents/blockblast/src/features/game/components/TutorialHints.tsx), [useDrag.ts](C:/Users/Dima2/Documents/blockblast/src/features/game/drag/useDrag.ts).
- [TrayPiece.tsx](C:/Users/Dima2/Documents/blockblast/src/features/game/components/TrayPiece.tsx), [motion.ts](C:/Users/Dima2/Documents/blockblast/src/features/game/animation/motion.ts) — центрирование и зазор лотка.
- [ObjectivePanel.tsx](C:/Users/Dima2/Documents/blockblast/src/features/adventure/components/ObjectivePanel.tsx), [JewelCollectionFlightLayer.tsx](C:/Users/Dima2/Documents/blockblast/src/features/adventure/components/JewelCollectionFlightLayer.tsx), [FailOverlay.tsx](C:/Users/Dima2/Documents/blockblast/src/features/adventure/components/FailOverlay.tsx), [LevelResultView.tsx](C:/Users/Dima2/Documents/blockblast/src/features/adventure/components/LevelResultView.tsx), [SeasonCelebration.tsx](C:/Users/Dima2/Documents/blockblast/src/features/adventure/components/SeasonCelebration.tsx).
- [LevelUpReveal.tsx](C:/Users/Dima2/Documents/blockblast/src/features/mascot/components/LevelUpReveal.tsx), [MascotLayer.tsx](C:/Users/Dima2/Documents/blockblast/src/features/mascot/components/MascotLayer.tsx), [MascotArt.tsx](C:/Users/Dima2/Documents/blockblast/src/features/mascot/components/MascotArt.tsx), [Wardrobe.tsx](C:/Users/Dima2/Documents/blockblast/src/features/mascot/components/Wardrobe.tsx).
- Экраны [index.tsx](C:/Users/Dima2/Documents/blockblast/src/app/index.tsx), [game.tsx](C:/Users/Dima2/Documents/blockblast/src/app/game.tsx), [adventure-level.tsx](C:/Users/Dima2/Documents/blockblast/src/app/adventure-level.tsx), [map.tsx](C:/Users/Dima2/Documents/blockblast/src/app/map.tsx), [leaderboard.tsx](C:/Users/Dima2/Documents/blockblast/src/app/leaderboard.tsx), [capy.tsx](C:/Users/Dima2/Documents/blockblast/src/app/capy.tsx), [settings.tsx](C:/Users/Dima2/Documents/blockblast/src/app/settings.tsx).
- [NextActionCard.tsx](C:/Users/Dima2/Documents/blockblast/src/features/home/components/NextActionCard.tsx), [ProfileOverlay.tsx](C:/Users/Dima2/Documents/blockblast/src/features/profile/components/ProfileOverlay.tsx), короткие строки в [ru.ts](C:/Users/Dima2/Documents/blockblast/src/core/i18n/ru.ts) и [en.ts](C:/Users/Dima2/Documents/blockblast/src/core/i18n/en.ts).

## Визуальная проверка

Проверены Home, Classic и его результат, пауза, FTUE, карта Adventure, игровой экран Adventure, его поражение и результат, карта общего прогресса, рейтинг в offline/error, Капи, гардероб, профиль, все три вкладки настроек.

- Android emulator: 1080×1920, density 420, примерно 411×731dp; существующая debug-установка и Metro.
- Web: 390×844, 360×640 и отдельные наиболее тесные экраны на 320×640.
- Проверены раскрытие награды и совета, открытие гардероба, продолжение/пауза и действия навигации.
- Для воспроизводимых Classic terminal и Adventure fail использованы fixture-сохранения только в изолированном браузерном профиле; native MMKV не очищался и не заполнялся фиктивными данными.
- Запросы API в браузерной проверке моделировались 503; эти ошибки не являются диагностикой доступности production.

Снимки:

- [Исходный Android-результат](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/native-before.png).
- [Компактный результат, 360px](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/classic-result-final.png).
- [Поражение Adventure](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/web-adventure-fail.png).
- [Цель Adventure](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/web-adventure-level.png).
- [Карта, 320px](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/map-320-final.png).
- [Рейтинг с одним сообщением об ошибке](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/leaderboard-final.png).
- [Профиль, 320px](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/profile-320-final.png).
- [Капи](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/web-capy.png).
- [Гардероб после удаления лишних сводок](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/wardrobe-final.png).
- [Настройки](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/web-settings.png).
- [Пять клеток полностью внутри лотка после фикса frame](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/tall-piece-frame-verified.png).
- [Успешное размещение пяти клеток на Android: 1002 → 1007](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/native-drag-verified.png).

## Проверки и ограничения

До правок: целевые 12 наборов / 54 теста прошли. Финальный полный Jest: **172 набора / 1091 тест — PASS**. TypeScript — PASS. ESLint — 0 ошибок, два прежних предупреждения в adventure/logic/seasons.ts и mascot/logic/types.ts. Diff check — PASS. [Полный лог тестов](C:/Users/Dima2/Documents/blockblast/output/playwright/ui-trim-2026-09-20/tests-final.log).

После последнего уточнения размеров artwork-frame дополнительно прошли 25 тестов лотка/масштаба/жестов и TypeScript. Финальный frame длинной фигуры проверен на web-снимке; отдельная проверка именно этого состояния в нативной release-сборке не заявляется. Android-проверка жеста подтвердила размещение всех пяти клеток и смену трея.

Устаревшие тесты, требовавшие видимых абзацев, заменены проверками доступного описания, точных чисел/порогов, раскрытия деталей и реальных callbacks. Сохранены проверки начислений, revive, отключённых действий, arrival-дедупликации, progression и уведомлений.

Это визуальная/функциональная проверка, не доказательство роста D1/D7. Физический release-профиль FPS и полноценный TalkBack-аудит не выполнялись. После dev reload эмулятор без установленного RuStore показывает системный диалог SDK об установке магазина; этот сторонний диалог не переделывался. Обычные сообщения об ошибках, согласии, сохранении данных и управлении оставлены там, где они нужны для решения пользователя.
