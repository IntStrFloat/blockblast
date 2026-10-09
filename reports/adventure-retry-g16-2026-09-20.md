# G16 — понятный и посильный повтор Adventure

## Решение

FailOverlay больше не обещает, что цель «уже близко». Он показывает фактический
результат:

- score: «Счёт current/target, осталось remaining»;
- jewels: «Собрано current/target, осталось remaining»;
- один совет, выбранный из последней terminal-доски: линия с кристаллами,
  свободный центр или завершение одной линии.

Советы не утверждают, что на terminal-доске существует legal move.

После **двух последовательных поражений** на первых **пяти уровнях** личной
кампании появляется добровольный выбор:

- «Попробовать с подсказкой»;
- «Попробовать без подсказки»;
- «Выйти».

Подсказка бесплатна, не связана с рекламой и в новой попытке показывает один
детерминированный legal placement через существующий board preview. Цель,
генератор, seed, scoring и правила не меняются. Первый принятый ход атомарно
помечается assisted; дальше попытка обычная. Guidance живёт в отдельном
assist-preview channel: drag временно рисуется поверх него, а invalid finalize
не может стереть подсказку до первого valid placement.

## Durable policy и миграция

Adventure checkpoint поднят до v3 и содержит:

- failureCount — последовательные settled failures этого уровня;
- helpPolicy = none | highlight | declined;
- helpUsed.

Поражение увеличивает счётчик только в идемпотентном outcome settlement.
Добровольный restart увеличивает attempt, но не failureCount; выбранная
политика переносится в новую попытку. Win сбрасывает счётчик в ноль. Suspend,
cold resume и offline читают те же поля из локального checkpoint. Accept или
decline сначала критически записывается в terminal checkpoint и только затем
открывает analytics/ad/interstitial async boundary; process death во время
рекламы не теряет выбор.

Миграция v1/v2 намеренно задаёт failureCount=0, helpPolicy=none,
helpUsed=false. Старые поражения не начисляются задним числом и не вызывают
молчаливое предложение помощи.

## Fixed-seed сценарии

Проверены уровни 1–5, attempts 0–2 и две простые стратегии:

| Стратегия | Победы | Поражения | Ходы до terminal |
| --- | ---: | ---: | ---: |
| первый legal placement | 14/15 | 1/15 | 3–11 |
| greedy по очищаемым линиям | 15/15 | 0/15 | 3–7 |
| всего | 29/30 | 1/30 | 3–11 |

Матрица повторяется побайтно на тех же seeds. Единственный fail —
level 3 / attempt 2 / first-legal, 5 ходов и 32 очка. Это полезный сценарный
сигнал, но не доказательство человеческой сложности или «нечестности»
генератора. Отдельный тест подтверждает, что highlight сохраняет исходные
board/tray/objective/seed и первый подсвеченный ход не завершает уровень
автоматически.

## Метрики и эксперимент

Добавлены failure_count и help_policy в start/fail, а также
adventure_retry_decision (standard, help, exit, voluntary_restart).
Существующий canonical run_result даёт active duration, а
piece_accepted.guidance=assisted отличает реально использованную подсказку.

scripts/analytics/adventure-retry-g16.sql строит:

- win rate по level/attempt/help policy;
- fail→retry, help acceptance и exit после второй неудачи;
- p50/p95 времени уровня;
- D1 среди Adventure-first установок через canonical cohort baseline.

Текущей новой выгрузки событий нет, поэтому численный production baseline не
выдуман. После релиза сначала проверить полноту событий и checkpoint, затем
сравнить один вариант offer против контроля. D1/retention — результат
эксперимента; точность результата, сохранение, отказ и offline — обязательная
функциональная приёмка.

## Приёмка

- точный score/jewel result и remaining: PASS;
- релевантный tip без обещания legal move: PASS;
- fail/retry, second-fail offer и явный отказ: PASS;
- failure count отдельно от attempt/restart: PASS;
- policy/use persisted across suspend/cold resume/offline: PASS;
- accept/decline committed before interstitial/process-death boundary: PASS;
- settled failure history survives FailOverlay exit→hub→reopen: PASS;
- invalid drag leaves the unconsumed highlight available: PASS;
- chosen highlight consumed with first valid placement: PASS;
- win resets consecutive failures: PASS;
- v1/v2 migration does not backfill past failures: PASS;
- fixed-seed multi-strategy matrix: PASS, not a human-play substitute.

## Verification

- focused G16: 8 suites, 82 tests passed;
- full frontend: 159 suites, 1032 tests passed;
- backend: 16 tests passed;
- TypeScript: pass;
- Expo lint: pass with two pre-existing warnings outside G16;
- visual component contract: exact result, one tip, 48dp+ actions, explicit
  help/refusal/exit and modal accessibility; physical TalkBack/feel check
  remains part of release-device QA.
