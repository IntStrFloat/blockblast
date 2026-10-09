# G11 — численная цель Adventure и сохранная presentation-очередь

## Решение

- Objective HUD постоянно называет цель и число: `Очки current/target` либо
  `Кристаллов осталось N`. Полоса остаётся вторичным индикатором.
- Каждый принятый Adventure-ход получает стабильный `presentationId`, составленный
  из `runId`, attempt и итогового score. Durable `AdventureRun` обновляется и
  сохраняется до presentation; анимация ничего не начисляет.
- Jewel flight использует bounded FIFO из четырёх batch. Переполнение агрегируется
  в последний pending batch: итоговый durable total сохраняется, представителей
  остаётся не больше трёх, а `+N` показывает полный вклад.
- Objective HUD не имеет собственного 430-ms таймера. Он удерживает монотонное
  показанное число и продвигается только по arrival того же presentation lifecycle.
  Несколько быстрых сборов суммируют pending `+N`, число не откатывается.
- При reduced motion arrival применяется сразу (`wait_ms=0`) и flight не монтируется.
  При финальном сборе result ждёт arrival; если presentation layer недоступен,
  bounded fallback 1320 ms всё равно открывает долговечный результат.

## Проверенные границы

- два сбора быстрее прежних 430 ms сохраняются как два FIFO batch;
- очередь ограничена четырьмя batch, overflow агрегирует delta/total;
- больше трёх камней отображаются тремя представителями и полным `+N`;
- финальный jewel win ждёт согласованного arrival, но не может зависнуть;
- cold hydrate и restart меняют component key по фактическому `runId`: частичный
  durable total показывается сразу даже при `lastAdventureEvent=null`, новый run
  начинает с собственного нуля;
- suspend/resume и process death восстанавливают durable total без повторной
  анимационной выдачи (`lastAdventureEvent=null` на resume);
- фон лишь задерживает JS timer; после возврата arrival берёт durable total и
  применяет `max(previous,total)`, поэтому current не уменьшается;
- reduced motion использует немедленный путь без полёта.

Нативное визуальное доказательство:

- `output/g11-native/score-hud-360.png` — `Очки 41/156` при 360dp/100%;
- `output/g11-native/score-hud-320-f1.6.png` — та же цель полностью читается при
  320dp/160%, поле и трей не перекрыты;
- visual verdict: 95/100, threshold 90, pass.

## Метрики

События:

- `adventure_objective_collected`: durable commit, delta/total/remaining;
- `adventure_objective_hud_arrived`: presentation id, HUD wait, reduced-motion;
- `adventure_level_fail`: objective/current/target/remaining для near-goal анализа;
- существующие `adventure_level_start/win` дают прохождение первых пяти уровней.

Запросы находятся в `scripts/analytics/adventure-objective-g11.sql`: p50/p95 HUD
wait, fail→retry при остатке ≤20% цели и funnel первых уровней. Эти метрики нужны
для проверки ожидания HUD и поведения, но retention остаётся экспериментальным
результатом, а не доказательством функциональной корректности.

## Верификация

- TypeScript: pass.
- Expo lint: pass с двумя прежними warnings вне G11.
- Focused G11/G06: 6 suites, 22 tests passed after the cold-hydrate regression.
- Full frontend: 148 suites, 989 tests passed.
- Backend: 16 tests passed.
