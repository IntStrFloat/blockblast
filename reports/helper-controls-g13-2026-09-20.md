# G13 — helpers независимы от декоративного Капи

## Решение

- `HelperControls` монтируется отдельным sibling в стабильной полосе управления
  Classic. `showMascot=false`, `lost` и падение art-layer не меняют helper rules.
- Adventure не монтирует HelperControls и не получает helpers автоматически.
- HelperHint/HelperSwap сохраняют progression unlock, daily limit, charges,
  rewarded readiness/cooldown и применимость к текущей board/tray.
- На helper chips показывается остаток charges; после подтверждённого использования
  виден результат и оставшийся баланс. Press locks/undo window исключают двойное
  списание.
- Swap Undo — транзакция: неизменённый post-swap state реально откатывается
  бесплатно; если игрок уже сделал ход, stale Undo коммитит helper use ровно один
  раз вместо отмены списания.
- После падения Капи автоматически возвращается через 1.4 s в той же партии;
  epoch recovery остаётся страховкой после interruption/process death.
- Жесты Капи меняют только art/emote/speech/lost и не вызывают helper store actions.

## Приёмка

- source contract подтверждает отсутствие HelperHint/Swap внутри MascotLayer;
- helper layer не читает `showMascot`/`lost` и монтируется только в Classic;
- store regression: один charged use списывает ровно один, duplicate отклоняется;
- pure transaction regression покрывает swap→move→stale Undo и rapid duplicate;
- два helper-control расположены одной 44dp строкой: её нижняя граница −11dp
  относительно board при текущих Classic flow constants, поэтому на 360×640 она
  не перекрывает поле;
- rewarded/unavailable/double-tap contracts остаются покрыты;
- гардероб и equip остаются в MascotLayer/Profile и не менялись.

## Метрики

`helper_funnel` фиксирует helper, stage (`eligible/shown/used`), source
(`free/charge/rewarded`) и remaining charges. Запрос
`scripts/analytics/helper-funnel-g13.sql` строит funnel и связывает use с
последующим first independent clear. Польза не оценивается только ad views.

## Верификация

- TypeScript и Expo lint: pass (два прежних warnings вне G13).
- Focused transaction/control pass: 5 suites, 32 tests passed.
- Full frontend: 151 suites, 1005 tests passed.
- Backend: 16 tests passed.
- Visual contract verdict: 93/100; seeded unlocked-helper screenshot остаётся
  device-lab follow-up, functional boundaries покрыты component/store tests.
