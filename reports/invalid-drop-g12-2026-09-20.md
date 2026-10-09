# G12 — понятные ошибки размещения

## Поведение

- UI-thread классификация различает `valid`, `occupied`, `outside-board`.
- `occupied` показывает footprint с пунктирной обводкой и X-паттерном на
  конфликтующих клетках; это не только красный цвет и не модальное окно.
- `outside-board` очищает footprint и нейтрально возвращает фигуру в трей.
- После второй подряд занятой позиции появляется короткое rate-limited пояснение;
  звук и вибрация не обязательны. Валидный ход сбрасывает серию.
- Фигура без legal placement остаётся визуально и accessibility-disabled, но tap
  и accessibility action объясняют: «Сначала освободи место другой фигурой».
- Все per-frame вычисления остаются в worklet/shared values; RN вызывается только
  на release/press. Engine commit остаётся страховкой и невалидный drop не меняет
  board/score/tray.

## Проверки

- valid/occupied и четыре края доски;
- повтор ошибки, cooldown и сброс после valid;
- unavailable piece tap/focus;
- haptics off и отсутствие обязательного sound;
- существующие multitouch ownership, geometry remeasure и commit safety tests;
- reduced motion сохраняет статическую обводку/паттерн и текстовое объяснение.

Нативные доказательства:

- `output/g12-native/occupied-conflict.png` — пунктирный конфликтный footprint;
- `output/g12-native/repeat-explanation.png` — пояснение после повторной ошибки;
- `output/g12-native/unavailable-explanation.png` — объяснение disabled-фигуры.

## Метрики

`invalid_drop` содержит mode/reason/streak/placement_index/shape_id. Запрос
`scripts/analytics/invalid-drop-g12.sql` агрегирует причины и серии первых 20
ходов, затем связывает их с первым самостоятельным clear и исходом run. UX-эффект
оценивается по снижению безрезультатных серий и росту first independent clear;
retention этим функциональным исправлением не объявляется.

## Верификация

- TypeScript и Expo lint: pass (два прежних warnings вне G12).
- Focused: 5 suites, 54 tests passed after the G04 reason regression.
- Full frontend: 149 suites, 997 tests passed.
- Backend: 16 tests passed.
- Visual verdict: 96/100, threshold 90, pass.
