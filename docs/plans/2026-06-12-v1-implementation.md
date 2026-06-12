# Block Blast v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Играбельный клон Block Blast (Expo SDK 56) с монетизацией за флагами и release APK для RuStore.

**Architecture:** Чистый TS-движок (core/engine, TDD) → zustand-сторы → UI на Views+Reanimated (drag на UI-потоке). Спеки в `docs/specs/` — источник истины: правила/скоринг (03), анимации (04), монетизация (05), перф-правила (07), сборка (08).

**Tech Stack:** Expo 56 / RN 0.85 / Reanimated 4 / gesture-handler 2 / zustand / MMKV 4 (+nitro) / expo-audio / expo-haptics / jest-expo.

Проверка каждой задачи: `npm test` и `npx tsc --noEmit` зелёные → commit (conventional, на русском).

---

### Task 1: Тулинг и зависимости
- [x] `npx expo install expo-haptics expo-audio expo-localization @expo-google-fonts/unbounded` + `npm i zustand react-native-mmkv react-native-nitro-modules` + `npm i -D jest jest-expo @types/jest`
- [x] jest config (package.json): preset `jest-expo`, `transformIgnorePatterns` под Expo-стандарт; smoke-тест `src/core/engine/__tests__/smoke.test.ts` (1+1)
- [x] Удалить демо-файлы шаблона (`src/app/explore.tsx`, demo-компоненты), минимальный `_layout` + пустые экраны-заглушки index/game/settings
- [x] Прогон: `npm test`, `npx tsc --noEmit` → commit `chore: тулинг (jest, mmkv, zustand, audio/haptics) + чистка шаблона`

### Task 2: core/engine — типы, RNG, каталог фигур (TDD)
**Files:** `src/core/engine/{types.ts,rng.ts,shapes.ts}` + `__tests__/{rng,shapes}.test.ts`
- [x] Тесты RNG: детерминизм seed, диапазон [0,1), различие последовательностей
- [x] mulberry32 + `nextInt`, состояние наружу (для GameState.rngState)
- [x] Тесты каталога: ≥35 форм, id уникальны, клетки в bbox w×h, связность (BFS), веса > 0, наличие ключевых форм (1x1, 3x3, I-tetromino гориз/верт, L/T/S/Z ориентации, 2x3, 1x5)
- [x] `shapes.ts`: каталог по спеке 03 (линии/квадраты/прямоугольники/уголки/L/J/T/S/Z с ориентациями, веса)
- [x] commit `feat(engine): rng + каталог фигур`

### Task 3: core/engine — board ops + размещение/очистка (TDD)
**Files:** `src/core/engine/board.ts` + tests
- [x] Тесты: `canPlace` (границы/пересечения), `findFullLines` (строка, столбец, оба разом, пересечение 1 раз), `applyPlacement`, `clearLines`, `hasAnyMove`, `isBoardEmpty`
- [x] Реализация (board = number[64])
- [x] commit `feat(engine): board ops`

### Task 4: core/engine — scoring + place + game over + serialize (TDD)
**Files:** `src/core/engine/{scoring.ts,game.ts,serialize.ts,config.ts,index.ts}` + tests
- [x] Тесты scoring по таблице спеки 03: размещение +cells; 1 строка=90; 2 линии=20·10+20=220 (wait: 2 линии могут пересекаться — считаем по факту clearedCells); boardClear +360; комбо ×(1+0.5·(combo−1)), сброс при ходе без очистки
- [x] Тесты place: события PlacementEvent полностью (placed, cleared, scoreDelta, combo, praise good/great/amazing/unbelievable, onFire, newTray, gameOver)
- [x] Тесты: game over после установки и после новой волны; revive очищает доску, сохраняет счёт; serialize roundtrip + reject битых версий; детерминизм партии по seed
- [x] Реализация: `createGame(seed?, config?)`, `place`, `revive`, `serialize/deserialize` (формат `{v:1, ...}`), `GameConfig` дефолты из спеки
- [x] commit `feat(engine): scoring, place, game over, serialize`

### Task 5: core/storage + core/i18n
**Files:** `src/core/storage/{mmkv.ts,index.ts}`, `src/core/i18n/{index.ts,ru.ts,en.ts,praise.ts}` + tests (i18n: фолбэк ключей, оба тона похвал ru/en)
- [ ] storage: единый MMKV-инстанс, `getJSON/setJSON/remove`, ключи-константы из спеки 02; **мокается в jest** (jest-setup: mock react-native-mmkv → in-memory Map)
- [ ] i18n: словари ru/en (все строки UI), `t(key)`, `praiseText(tier, tone, lang, comboN)`; локаль из expo-localization c override из настроек
- [ ] commit `feat(core): storage (mmkv) + i18n ru/en с двумя тонами похвал`

### Task 6: ui/ — токены, шрифт, AppText, кнопки
**Files:** `src/ui/{theme.ts,AppText.tsx,primitives/GameButton.tsx,primitives/Overlay.tsx,index.ts}`
- [ ] theme.ts по спеке 04: colors, темы блоков Classic+Y2K (`BlockTheme`), spacing, radii; `getCellSize(width)`
- [ ] AppText: пресеты title/score/body/caption, Unbounded для title/score
- [ ] GameButton (Pressable + scale-spring), Overlay (scrim + появление)
- [ ] commit `feat(ui): дизайн-токены, AppText (Unbounded), примитивы`

### Task 7: features/settings + scores + streak (сторы, TDD на логику)
**Files:** `src/features/settings/{store.ts,index.ts}`, `src/features/scores/{store.ts,index.ts}`, `src/features/streak/{logic.ts,store.ts,index.ts}` + tests
- [ ] settings: {sound, haptics, praiseTone:'classic'|'meme', themeId, lang:'system'|'ru'|'en'} + persist
- [ ] scores: {best, gamesPlayed, totalLinesCleared} + `submitGame(score, lines)` → возвращает `{newRecord, delta}`
- [ ] streak: `bumpStreak(prev, todayISO)` чистая функция (same-day idempotent, +1 если вчера, reset иначе) + тесты на рубежи дат; store persist
- [ ] commit `feat: сторы настроек, рекордов, стрика`

### Task 8: features/monetization (Noop, флаги, частоты, TDD)
**Files:** `src/features/monetization/{types.ts,config.ts,noop.ts,frequency.ts,entitlements.ts,index.ts}` + tests (frequency: minGames/minInterval/everyN; entitlements persist)
- [ ] По спеке 05: интерфейсы, Noop-провайдеры (+`fakeRewardedInDev` через `__DEV__`), фабрика `getAds()/getIap()`, `shouldShowInterstitial(meta, now)` чистая функция
- [ ] commit `feat(monetization): интерфейсы, noop-провайдеры, частотные правила`

### Task 9: features/game — стор партии + автосейв
**Files:** `src/features/game/{store.ts,index.ts}` + tests
- [ ] zustand: `state: GameState`, `lastEvent: PlacementEvent|null`, действия `newGame/placePiece/reviveGame/loadSaved`; автосейв в MMKV после хода; `clearSave` на game over (рекорд фиксируется через scores.submitGame + streak.bump)
- [ ] Тесты: place обновляет, автосейв/восстановление, game over → save очищен
- [ ] commit `feat(game): стор партии с автосейвом`

### Task 10: features/game — Board + Tray + drag (ядро UX)
**Files:** `src/features/game/components/{BoardView.tsx,BoardCell.tsx,TrayView.tsx,TrayPiece.tsx,DragLayer.tsx}`, `src/features/game/drag/{useDrag.ts,gridMath.ts}` + tests на gridMath (px→ячейка, anchor)
- [ ] gridMath: чистые функции расчёта клетки под фигурой (учёт подъёма −60px и якоря фигуры)
- [ ] BoardCell: React.memo, цвет по colorId; превью-подсветка через shared value (`previewMask: SharedValue<number[]>` или 64 derived) — БЕЗ ре-рендеров (спека 07)
- [ ] Drag: Gesture.Pan в worklet, scale 0.65→1, подъём, ghost-превью, runOnJS только на дроп; невалидный дроп → spring назад
- [ ] Анимации размещения/очистки по спеке 04 (scale/fade, стаггер 18мс волной от точки)
- [ ] commit `feat(game): доска, трей, drag-n-drop на UI-потоке`

### Task 11: features/game — эффекты + звук + хаптика
**Files:** `src/features/game/effects/{Particles.tsx,PraiseBanner.tsx,ComboBadge.tsx,Confetti.tsx,useShake.ts}`, `src/features/game/sound/{sounds.ts,useGameFeedback.ts}`, `scripts/gen-sounds.js`, `assets/sounds/*.wav`
- [ ] gen-sounds.js: node-скрипт синтеза WAV (pickup, drop, clear1..3, gameover, record) — sine/triangle + envelope, ≤400мс; закоммитить и скрипт, и WAVы
- [ ] useGameFeedback(event): маппинг PlacementEvent → звук+хаптика по таблицам спеки 04, уважает settings
- [ ] Particles/Confetti: фиксированный пул, PraiseBanner с текстом из i18n по тону, shake доски при 2+ линиях
- [ ] commit `feat(game): джус — частицы, похвалы, звук, хаптика`

### Task 12: экраны — Game (HUD, Pause, GameOver), Home, Settings
**Files:** `src/app/{_layout.tsx,index.tsx,game.tsx,settings.tsx}`, `src/features/game/components/{Hud.tsx,PauseOverlay.tsx,GameOverOverlay.tsx}`, `src/features/share/{shareScore.ts,index.ts}` (+ test форматтера эмодзи-грида), пасхалки (`src/features/game/easterEggs.ts` + test триггеров 13337/69420/100001)
- [ ] _layout: GestureHandlerRootView, фон-градиент, шрифты, StatusBar light, dark-only
- [ ] Game: HUD (анимированный счёт, best, пауза), оверлеи по спеке 01; GameOver: задержка 0.8с, серая заливка, рекорд+конфетти, Revive (через AdsProvider + reviveUsed), share, interstitial-хук после закрытия
- [ ] Home: лого-анимация, Continue/New, best, стрик-огонёк, переход в настройки
- [ ] Settings: все пункты спеки 01 (тон похвал, тема блоков, язык, звук/вибро, IAP-кнопки скрыты при iapEnabled:false, политика, сброс рекорда)
- [ ] Первая партия: 3 встроенные подсказки (i18n), скип касанием, флаг в MMKV
- [ ] commit `feat(app): экраны Home/Game/Settings, оверлеи, шеринг, пасхалки`

### Task 13: верификация качества
- [ ] `npm test` все зелёные; `npx tsc --noEmit` 0 ошибок; `npx expo-doctor`
- [ ] Запуск на эмуляторе: смоук core loop (разместить, очистить, game over, revive fake, продолжить партию после перезапуска)
- [ ] Анти-чеклист из 06 пройден
- [ ] commit fixes

### Task 14: сборка release APK (спека 08)
- [ ] app.json: package `com.intstrfloat.blockblast`, versionCode 1, dark, иконка/сплеш (сгенерить простые ассеты скриптом `scripts/gen-assets.js` — блоки на тёмном фоне)
- [ ] keystore: `credentials/release.jks` + `keystore.properties` (в .gitignore); `scripts/patch-signing.js`
- [ ] `npx expo prebuild -p android` → patch-signing → `gradlew assembleRelease` (JAVA_HOME=JBR)
- [ ] Установка APK на эмулятор, смоук; размер < 30МБ проверить
- [ ] commit `chore(release): пайплайн сборки v1.0.0 (vc1)` + push

### Task 15: RuStore-артефакты + сервер
- [ ] `store/privacy.html` (ru, оффлайн-игра без сбора данных) + деплой на сервер проекта (scp) → публичный URL
- [ ] `store/rustore.md`: тексты стора (название, описания, категория, рейтинг)
- [ ] push, финальный отчёт пользователю с путём к APK

**Прогресс-лог (для возобновления):** задача выполнена → чекбокс `[x]` прямо в этом файле.
