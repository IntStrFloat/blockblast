# Block Blastic: постоянный Android-эмулятор

Игра: `IntStrFloat/blockblast`, основной applicationId `com.intstrfloat.blockblast`.
Один AVD используется между фичами, ветками, worktree и чатами. Остановленный AVD
нужно запустить снова; к работающему подключаться. Клонировать или создавать
новый AVD под фичу нельзя. Данные и прогресс сохраняются между проверками.

## Этот Mac (Apple Silicon)

- AVD: `Cocos_Game_Lab_API35` — историческое имя сохранено для переиспользования.
- Android 15 / API 35, ARM64, 1080×1920, 4 ГБ RAM.
- ADB serial: `emulator-5580`.
- MCP: `android-game-lab`, уже зарегистрирован в Codex.
- Стенд: `/Users/d.bereznyov/Documents/Codex/2026-11-05/macos-apple-silicon-macos-apple-silicon/outputs/android-lab`.
- AVD находится в `devices/Cocos_Game_Lab_API35.avd` внутри стенда.

Запуск: `Start Emulator.command` внутри стенда. Проверка/установка из корня репо:

```bash
../android-lab/bin/adb.sh get-state
../android-lab/bin/adb.sh install -r dist/blockblast-1.1.46-vc51-local.apk
../android-lab/bin/adb.sh shell monkey -p com.intstrfloat.blockblast -c android.intent.category.LAUNCHER 1
```

`Record Session.command` в стенде записывает изображение и звук.
PNG исходного разрешения: `../android-lab/bin/adb.sh exec-out screencap -p > /tmp/blockblast.png`.
Через MCP: `start_session`, `screenshot`, `tap`, `swipe`, `audio_capture`.
Не запускать одновременно конкурирующие сценарии управления от разных агентов.
Для drag-and-drop учитывать подъём фигуры над пальцем; проверять результат
следующим кадром, а не только успешной отправкой жеста.

Во время непрерывных игровых анимаций UIAutomator может возвращать
`could not get idle state`. В этом случае наблюдать кадры и звук через scrcpy;
дерево accessibility не является надёжным источником состояния всей доски.
Замерять производительность отдельно от тяжёлой параллельной сборки на Mac.

## Другие компьютеры

Сначала проверить привязку игры, список существующих AVD и ADB/MCP-устройства.
На прежнем Windows-хосте политика и реестр находились в
`C:/Users/Dima2/.codex/android-avd-policy/README.md` и `registry.json`.
Их имена/serial могут отличаться от Mac. Дополнительная Android-конфигурация
нужна лишь для явно заданной матрицы устройств/версий или изолированного
параллельного теста. Если такого требования нет, переиспользовать назначенный AVD.
