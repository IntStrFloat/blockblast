# Маскот «Капи» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) или superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Зверёк-компаньон «Капи» в верхней части игрового экрана: бродит, реагирует на игру, прокачивается от активности (косметика + мягкие помощники), теряется при выбросе — ради retention, без нарушения core loop и анти-чеклиста.

**Architecture:** Новый модуль `features/mascot/` с **чистой TS-логикой** (`logic/` — прогрессия, поведенческий планировщик на seeded-RNG, правила; покрыта Jest) → zustand-стор с персистом MMKV (`mascot.state`) → UI на **Views + expo-linear-gradient + Reanimated** (ноль новых нативных зависимостей). Интеграция с игрой — через подписку на `useGameStore` и shared value `dragActive` (маскот замирает на время drag). Источник истины — [спека 09-mascot](../specs/09-mascot.md).

**Tech Stack:** Expo 56 / RN 0.85 / Reanimated 4 + worklets / gesture-handler 2 / zustand / MMKV 4 / expo-linear-gradient / expo-audio / expo-haptics / jest-expo.

Проверка каждой задачи: `npm test` и `npx tsc --noEmit` зелёные → commit (conventional, на русском). Числа баланса — в `MASCOT_CONFIG`, не в логике.

---

## Карта файлов

```
src/features/mascot/
├── index.ts                       # public API
├── store.ts                       # zustand + персист mascot.state
├── logic/                         # ЧИСТЫЙ TS (ноль импортов React/RN), TDD
│   ├── types.ts                   # Stage, Slot, ActionId, EmoteId, Mood, LevelReward, Cosmetic, ProgressInfo, HelperId, MascotState
│   ├── config.ts                  # MASCOT_CONFIG + xpToNext()
│   ├── cosmetics.ts               # COSMETICS[] (каталог)
│   ├── progression.ts             # progressFor / stageForLevel / rewardForLevel
│   ├── rules.ts                   # xpFromEvent / canFeed / canUseHelper
│   └── behavior.ts                # nextAction() weighted-scheduler
├── components/
│   ├── Mascot.tsx                 # анимированный «Капи» (View-композиция)
│   ├── Emote.tsx                  # пузырь-эмоция (✨💤💧♥… без текста)
│   ├── SpeechBubble.tsx           # ТЕКСТ только для потери/интро
│   ├── MascotChip.tsx             # уровень + XP-бар (тап → гардероб)
│   ├── FeedPrompt.tsx             # иконка кормления
│   ├── LevelUpReveal.tsx          # сюрприз-распаковка
│   ├── Wardrobe.tsx               # мини-экран (надеть косметику, статус помощников)
│   ├── HelperHint.tsx             # помощник A (подсказка хода)
│   ├── HelperSwap.tsx             # помощник B (унос фигуры)
│   ├── MascotIntro.tsx            # интро первого захода
│   └── MascotLayer.tsx            # позиционирование + gesture (tap/drag) + монтаж по настройке
└── hooks/
    └── useMascotBrain.ts          # тик планировщика; подписка на game-события; пауза на drag

Изменяемые файлы:
- src/core/engine/game.ts, index.ts          # + replaceTrayPiece
- src/core/storage/index.ts                   # + KEYS.mascot
- src/core/i18n/{mascot.ts,index.ts,ru.ts,en.ts}  # фразы Капи + label настройки
- src/features/settings/store.ts              # + showMascot
- src/features/game/store.ts, drag/DragContext.tsx, index.ts  # dragActive + replaceTrayPiece action
- src/app/game.tsx, settings.tsx              # монтаж слоя + тумблер
- src/ui/theme.ts                             # палитра Капи
- scripts/gen-sounds.js                       # feed/levelup/lost
- docs/specs/{01,03,04,05,06,07}.md           # точечные правки (§20 спеки)
```

---

## Фаза A — Чистая логика (TDD, Jest)

### Task 1: Каркас модуля, типы, конфиг, каталог косметики
**Files:**
- Create: `src/features/mascot/logic/types.ts`, `src/features/mascot/logic/config.ts`, `src/features/mascot/logic/cosmetics.ts`
- Test: `src/features/mascot/__tests__/config.test.ts`

- [ ] `types.ts`: объявить `Stage = 1|2|3|4`; `Slot = 'hat'|'face'|'accessory'|'skin'|'aura'`; `EmoteId = 'none'|'heart'|'sparkle'|'sleep'|'sweat'|'note'|'think'|'excl'|'fire'`; `Mood = 'happy'|'neutral'|'sad'`; `HelperId = 'hint'|'swap'`; `ActionId` (union 28 действий: walkLeft, walkRight, idle, sit, lieDown, sleep, yawn, stretch, scratch, lookScore, lookBoard, lookPlayer, wave, balanceBlock, rollBlock, pushBlock, peekDown, sniff, groom, dance, spin, hop, ponder, sparkleIdle, sneeze, wobble, faceplant, blink); интерфейсы `BehaviorAction {id; durationMs; dir?: -1|1; emote?: EmoteId}`, `BehaviorCtx {stage: Stage; hourOfDay: number; reduceMotion: boolean; mood: Mood}`, `LevelReward {kind:'cosmetic'|'helper'|'stage'; id: string}`, `Cosmetic {id; slot: Slot; minStage: Stage}`, `ProgressInfo {level; stage: Stage; xpInLevel; xpToNext}`, `MascotState {totalXp; level; unlocked: string[]; equipped: Partial<Record<Slot,string>>; lastFedDay: string|null; helpersUsedDay: Partial<Record<HelperId,string>>; lost: boolean; introDone: boolean; rngState: number}`.
- [ ] `config.ts`: интерфейс `ActionSpec {id: ActionId; weight: number; cooldownMs: number; minStage: Stage; minDurationMs: number; maxDurationMs: number; moving?: boolean; calm?: boolean; nightBoost?: number; emote?: EmoteId}`. Объект `MASCOT_CONFIG`: `maxLevel: 24`; `stageBounds: [{stage:1,from:1,to:4},{stage:2,from:5,to:11},{stage:3,from:12,to:19},{stage:4,from:20,to:24}]`; `xp: {perClearedLine:3, comboTierBonus:1, newRecord:50, boardClear:20, dailyFeed:40}`; `helpers: {hint:{unlockLevel:5}, swap:{unlockLevel:12}}`; `nightHour:22`; `blink:{minMs:2200,maxMs:6000}`; `actions: ActionSpec[]` (все 28 с весами/кулдаунами/стадиями — черновые значения по §5.3 спеки: ходьба высокий вес, sleep `nightBoost:3`, редкие изюминки низкий вес + кулдаун 40–90с; `calm:true` для idle/sit/lieDown/sleep/blink/look*); `rewards: Record<number, LevelReward>` (ур.5 → `{kind:'helper',id:'hint'}`, ур.12 → `{kind:'helper',id:'swap'}`, остальные уровни → `{kind:'cosmetic',id:<cosmeticId>}` из каталога). Функция `xpToNext(level:number):number => Math.round(40 * Math.pow(1.18, level-1))`.
- [ ] `cosmetics.ts`: `export const COSMETICS: Cosmetic[]` — ≥22 предмета по слотам (hat: каскетка/корона-блок/панама; face: очки/солнцезащ./звёзды-глаза; accessory: наушники/шарф/рюкзак; skin: мятный/коралловый/хром-под-Y2K; aura: искры/звёзды для стадии 4), у каждого `minStage`.
- [ ] Тест `config.test.ts`: stageBounds покрывают непрерывно 1..24 без дыр; каждый `rewards[level]` с `kind:'cosmetic'` ссылается на существующий `COSMETICS.id`; число косметических наград ≥ (24 − число helper-вех); `xpToNext` строго растёт и `xpToNext(1) === 40`.
- [ ] `npm test`, `npx tsc --noEmit` → commit `feat(mascot): типы, конфиг прокачки, каталог косметики`

### Task 2: progression.ts — XP → уровень/стадия/награда (TDD)
**Files:**
- Create: `src/features/mascot/logic/progression.ts`
- Test: `src/features/mascot/__tests__/progression.test.ts`

- [ ] Тесты: `progressFor(0)` → `{level:1, stage:1, xpInLevel:0, xpToNext:40}`; накопление через несколько порогов даёт верный level и остаток `xpInLevel`; на `totalXp` ≥ суммы всех порогов → `level:24, stage:4, xpToNext:0, xpInLevel:0` (кламп MAX); `stageForLevel(4)===1`, `(5)===2`, `(12)===3`, `(20)===4`, `(99)===4`; `rewardForLevel(5)` → helper hint, `rewardForLevel(12)` → helper swap, `rewardForLevel(2)` → cosmetic, `rewardForLevel(99)` → null.
- [ ] Реализация: `stageForLevel(level)` (поиск по `stageBounds`, кламп); `progressFor(totalXp)` (цикл вычитания `xpToNext(level)` пока хватает и `level<maxLevel`); `rewardForLevel(level)` (`MASCOT_CONFIG.rewards[level] ?? null`).
- [ ] `npm test`, `npx tsc --noEmit` → commit `feat(mascot): прогрессия — xp в уровни/стадии/награды`

### Task 3: rules.ts — XP за событие, дневные лимиты (TDD)
**Files:**
- Create: `src/features/mascot/logic/rules.ts`
- Test: `src/features/mascot/__tests__/rules.test.ts`

- [ ] Тесты `xpFromEvent(event, isRecord)`: 1 очищенная линия → 3; 2 линии + combo=2 → 2·3 + 2·1 = 8; `boardCleared` добавляет 20; `isRecord` добавляет 50; ход без очистки (combo=0, 0 линий) → 0. `canFeed(null,'2026-06-13')===true`, `canFeed('2026-06-13','2026-06-13')===false`, `canFeed('2026-06-12','2026-06-13')===true`. `canUseHelper(undefined,'2026-06-13', level=5, 'hint')===true`; уровень ниже unlock → false; уже использовано сегодня → false.
- [ ] Реализация: `xpFromEvent(e: PlacementEvent, isRecord: boolean)` (тип `PlacementEvent` импортируется как type из `@/core/engine`); `canFeed(lastFedDay, today)`; `canUseHelper(usedDay, today, level, helper)` (проверка `level >= MASCOT_CONFIG.helpers[helper].unlockLevel && usedDay !== today`).
- [ ] `npm test`, `npx tsc --noEmit` → commit `feat(mascot): правила xp за событие и дневные лимиты`

### Task 4: behavior.ts — поведенческий планировщик (TDD)
**Files:**
- Create: `src/features/mascot/logic/behavior.ts`
- Test: `src/features/mascot/__tests__/behavior.test.ts`

- [ ] Тесты: **детерминизм** — два вызова `nextAction(recent, now, ctx, seed)` с одинаковыми аргументами равны; результат `action.id` ∈ каталоге и `durationMs` в `[minDurationMs, maxDurationMs]`; **стадия** — при `ctx.stage=1` никогда не выбирается действие с `minStage>1`; **кулдаун** — если `recent.set('sleep', now)` и `now-last < cooldown`, по 50 разным seed'ам `sleep` не выпадает; **reduce-motion** — при `ctx.reduceMotion=true` все результаты имеют `calm:true` (нет walk/dance/spin/hop/faceplant); **ночь** — при `hourOfDay=23` доля `sleep` по выборке из 200 seed заметно выше, чем при `hourOfDay=14` (проверка `nightBoost`); `moving`-действия возвращают `dir ∈ {-1,1}`.
- [ ] Реализация: `nextAction(recent: Map<ActionId,number>, now: number, ctx: BehaviorCtx, rngState: number)` → фильтр доступных (`stage`, `reduceMotion`→`calm`, кулдаун), взвешенный выбор (`weight * (ночь? nightBoost:1)`) на `rngNext` из `@/core/engine`; длительность и `dir` — добор `rngInt`; вернуть `{action, rngState}` (протянуть финальный state). Фолбэк на `idle`, если пул пуст.
- [ ] `npm test`, `npx tsc --noEmit` → commit `feat(mascot): поведенческий планировщик (seeded, кулдауны, ночь, reduce-motion)`

---

## Фаза B — Движок: подмена фигуры (для помощника B)

### Task 5: core/engine.replaceTrayPiece (TDD)
**Files:**
- Modify: `src/core/engine/game.ts`, `src/core/engine/index.ts`
- Test: `src/core/engine/__tests__/game.test.ts` (добавить describe)

- [ ] Тесты: `replaceTrayPiece(state, i)` меняет фигуру в слоте `i`, не трогает другие слоты; `rngState` меняется (детерминизм по seed); новая фигура `shape.id` ≠ id других текущих фигур трея (переиспользует `exclude` как в `makeWave`); счёт/доска не меняются.
- [ ] Реализация в `game.ts` (рядом с приватным `pickWeighted`): `export function replaceTrayPiece(state, trayIndex, config = DEFAULT_CONFIG): GameState` — `exclude` из id остальных непустых слотов, `pickWeighted` + `rngInt` для цвета, вернуть новый `state` с обновлённым `tray` и `rngState`. Экспортировать из `index.ts`.
- [ ] `npm test`, `npx tsc --noEmit` → commit `feat(engine): replaceTrayPiece для подмены непомещаемой фигуры`

---

## Фаза C — Стор, персист, i18n

### Task 6: storage-ключ + настройка showMascot
**Files:**
- Modify: `src/core/storage/index.ts`, `src/features/settings/store.ts`
- Test: `src/features/settings/__tests__/store.test.ts` (дополнить)

- [ ] `storage/index.ts`: добавить в `KEYS` поле `mascot: 'mascot.state'`.
- [ ] `settings/store.ts`: в `SettingsData` добавить `showMascot: boolean`; в `DEFAULTS` — `showMascot: true`; включить в деструктуризацию `update`/persist.
- [ ] Тест settings: дефолт `showMascot===true`; `update({showMascot:false})` персистится в `KEYS.settings`.
- [ ] `npm test`, `npx tsc --noEmit` → commit `feat: ключ mascot.state + настройка «Показывать Капи»`

### Task 7: features/mascot/store.ts — стор маскота (TDD)
**Files:**
- Create: `src/features/mascot/store.ts`, `src/features/mascot/index.ts`
- Test: `src/features/mascot/__tests__/store.test.ts`

- [ ] Стор `useMascot` (zustand) поверх `MascotState` + действия:
  - `applyEvent(event, isRecord)` → `totalXp += xpFromEvent(...)`; пересчёт `level` через `progressFor`; если уровень вырос — для каждого пройденного уровня собрать `rewardForLevel`, косметику добавить в `unlocked` (без дублей); вернуть `{leveledTo, rewards: LevelReward[]}`.
  - `feed()` → если `canFeed(lastFedDay, todayISO())`: `totalXp += dailyFeed`, `lastFedDay = today`, пересчёт уровня + разлок (как выше); иначе вернуть `null`.
  - `useHelper(id)` → если `canUseHelper(helpersUsedDay[id], today, level, id)`: проставить `helpersUsedDay[id]=today`, вернуть `true`; иначе `false`.
  - `drop()` → `lost=true`; `recover()` → `lost=false`.
  - `equip(slot, id)` → если `unlocked.includes(id)`: `equipped[slot]=id`.
  - `markIntroDone()`; `bumpRng(state)` (сохранить seed планировщика).
  - Персист всего `MascotState` в `KEYS.mascot` после каждой мутации; загрузка `getJSON` при инициализации с дефолтами (`totalXp:0, level:1, unlocked:[], equipped:{}, lastFedDay:null, helpersUsedDay:{}, lost:false, introDone:false, rngState: seedFromTime()`).
- [ ] `index.ts`: экспорт `useMascot` и публичных типов (`MascotState`, `Slot`, `Stage`, `HelperId`); компоненты-слой и хук добавятся в следующих задачах.
- [ ] Тесты (мок MMKV из `jest-setup.js`): `applyEvent` копит xp и поднимает уровень, отдаёт rewards с разлоченной косметикой; `feed` работает раз в день (через границу: повторный `feed()` тем же днём → `null`); `useHelper('hint')` ложно ниже ур.5, истинно на ур.5, повторно сегодня → false; `drop()`/`recover()` переключают `lost`; `equip` только разлоченным; round-trip персиста (новый стор читает сохранённое). `beforeEach` сбрасывает стор через `setState` (как в `scores/__tests__`).
- [ ] `npm test`, `npx tsc --noEmit` → commit `feat(mascot): стор прокачки/кормления/помощников/потери + персист`

### Task 8: core/i18n — фразы «Капи» (потеря + интро, 2 тона)
**Files:**
- Create: `src/core/i18n/mascot.ts`
- Modify: `src/core/i18n/index.ts` (ре-экспорт)
- Test: `src/core/i18n/__tests__/i18n.test.ts` (дополнить)

- [ ] `mascot.ts` (паттерн `praise.ts`): структуры `MASCOT_LOST: Record<Lang, Record<PraiseTone, string[]>>` (несколько вариантов; classic ru: `['я потеряяялся (((']`; meme ru: `['ну и куда ты меня… теперь ищи','я в свободном падении ееее']`), `MASCOT_INTRO: Record<Lang, Record<PraiseTone, [string,string,string,string]>>` (4 beat'а; classic ru: `['Привет! Я Капи 🫧','Живу тут — наверху 👋','Ты играешь — я расту 📈','Заходи каждый день — стану легендой']`); EN-аналоги. Функции `mascotLost(tone, lang, rng?): string` (детерминируемый/случайный выбор варианта) и `mascotIntro(beat: 0|1|2|3, tone, lang): string`.
- [ ] `index.ts`: ре-экспорт `mascotLost, mascotIntro`.
- [ ] Тест i18n: `mascotIntro(0,'classic','ru')` начинается с «Привет»; `mascotLost('meme','ru')` ∈ заданном наборе; для всех `lang×tone` массивы непусты.
- [ ] `npm test`, `npx tsc --noEmit` → commit `feat(i18n): реплики Капи (потеря + интро) ru/en × 2 тона`

---

## Фаза D — Рендер, мозг, слой

### Task 9: ui/theme — палитра «Капи»
**Files:**
- Modify: `src/ui/theme.ts`, `src/ui/index.ts`
- [ ] В `theme.ts` добавить `mascot` токены: `body0:'#B3B9F2', body1:'#7C84E6', ear:'#666FD8', muzzle:'#CDD2F9', blush:'#F2A6D8', ink:'#2B2440', block:'#FFD23F'`. Экспортировать (`colors`-стиль или отдельный объект `mascotPalette`) через `ui/index.ts`.
- [ ] `npx tsc --noEmit` → commit `feat(ui): палитра маскота Капи (лавандовый винил)`

### Task 10: Mascot.tsx — анимированный «Капи»
**Files:**
- Create: `src/features/mascot/components/Mascot.tsx`, `src/features/mascot/components/Emote.tsx`
- [ ] `Mascot.tsx`: композиция Animated-View (тело — скруглённый View с `expo-linear-gradient` `body0→body1`; уши/мордочка/глаза/блок-подпись — View; глянец — полупрозрачный View). Пропсы: `stage: Stage`, `action: SharedValue<BehaviorAction|null>` (или примитивные shared values позы), `equipped`, `frozen: SharedValue<number>` (1 = drag, замереть). Анимации только transform/opacity через `useAnimatedStyle`: ходьба = `translateX` + bob `translateY`; squash = `scaleX/scaleY`; моргание = `scaleY` глаз; при `frozen.value` поза фиксируется. Стадия 1 — без блока на макушке и крупные открытые глаза; 2 — базовая; 3 — крупнее + слот аксессуаров; 4 — корона-блоки + aura View. Косметика по `equipped` слоям поверх.
- [ ] `Emote.tsx`: маленький пузырь с символом-эмоцией по `EmoteId` (без текста), появление scale+fade, авто-исчезновение; пул/одиночка над головой.
- [ ] Smoke: временно отрендерить в `app/game.tsx` (или Storybook-заглушке) на каждой стадии; убедиться, что силуэт читается; затем убрать времянку. `npx tsc --noEmit`.
- [ ] commit `feat(mascot): анимированный Капи (View-композиция, стадии, эмоты)`

### Task 11: useMascotBrain — планировщик + реакции + пауза на drag
**Files:**
- Create: `src/features/mascot/hooks/useMascotBrain.ts`
- Modify: `src/features/game/drag/DragContext.tsx` (+ `dragActive: SharedValue<number>` в `DragCtx`), `src/features/game/index.ts` (тип)
- [ ] В `DragCtx` добавить `dragActive` (shared value 0/1); выставлять `1` в `onGrab`-пути и `0` на дропе/возврате (в `useDrag`). Экспортировать тип.
- [ ] `useMascotBrain({stage, reduceMotion, mood})`: держит `recent: Map<ActionId,number>` и текущий `action` (shared value); по таймеру/по завершении действия зовёт `nextAction(...)` с `rngState` из `useMascot`, обновляет позу и `bumpRng`; **пауза при drag** — `useAnimatedReaction` на `dragActive`, через `runOnJS` ставит флаг паузы (таймер не планирует новое действие); реакции: подписка на `useGameStore` (`lastEvent`) — на очистку/комбо/рекорд/почти-game-over/game-over прерывает idle реакцией и эмотом, и зовёт `useMascot.applyEvent(event, event.gameOver ? !!useGameStore.getState().finalResult?.newRecord : false)`. Частота тика низкая (≥ ~1.5–2с), `console.log` запрещён в горячем пути (спека 07).
- [ ] Smoke: «Капи» бродит, реагирует на очистку, замирает во время drag (визуально). `npx tsc --noEmit`.
- [ ] commit `feat(mascot): мозг — планировщик, реакции на игру, пауза на drag`

### Task 12: MascotLayer + MascotChip + интеграция в экран
**Files:**
- Create: `src/features/mascot/components/MascotLayer.tsx`, `src/features/mascot/components/MascotChip.tsx`
- Modify: `src/app/game.tsx`, `src/features/mascot/index.ts`
- [ ] `MascotChip.tsx`: компактный чип «🫧 ур.N» + тонкий XP-бар (`xpInLevel/xpToNext` из `progressFor(totalXp)`); тап открывает гардероб (Task 14). Только transform/opacity на анимации бара.
- [ ] `MascotLayer.tsx`: абсолютный слой в зазоре между HUD и доской; пол = верхняя кромка доски; рендерит `<Mascot/>` + `<MascotChip/>` + `<Emote/>`; `GestureDetector`: tap → реакция-эмоция (кулдаун), pan → поднять/двигать в пределах пола; **отпускание ниже пола / за пределы → `useMascot.drop()`** (см. Task 15). Монтируется только при `useSettings(s=>s.showMascot)`; уважает `AccessibilityInfo.isReduceMotionEnabled()` (прокидывает `reduceMotion` в мозг). Горизонтальные границы = ширина доски (`getBoardMetrics`).
- [ ] `app/game.tsx`: вставить `<MascotLayer/>` между `<Hud/>` и блоком доски; передать `dragActive` из `dragCtx`. Не менять размеры доски/трея.
- [ ] Smoke на коротком и высоком экране: доска не ужата, Капи не залезает на доску. `npx tsc --noEmit`.
- [ ] commit `feat(mascot): слой над доской, чип уровня, интеграция в игровой экран`

---

## Фаза E — UI прокачки

### Task 13: LevelUpReveal — сюрприз-распаковка
**Files:**
- Create: `src/features/mascot/components/LevelUpReveal.tsx`
- Modify: `src/features/mascot/hooks/useMascotBrain.ts` (триггер по `leveledTo`)
- [ ] Неблокирующий оверлей: коробка `🎁` подпрыгивает → «вскрывается» → предмет + название (i18n названия косметики) + Капи примеряет; конфетти/искры через существующий пул `effects/Confetti`. ≤1.2с, скип тапом, появляется **вне drag** (после хода). Несколько уровней за раз → дайджест «+N предметов» (без очереди оверлеев).
- [ ] Триггер: когда `applyEvent`/`feed` вернули `leveledTo>prevLevel` — показать reveal по последним `rewards`.
- [ ] Smoke: набрать XP в dev → распаковка проигрывается, скипается. `npx tsc --noEmit`.
- [ ] commit `feat(mascot): сюрприз-распаковка косметики на левел-апе`

### Task 14: Wardrobe — гардероб «Капи»
**Files:**
- Create: `src/features/mascot/components/Wardrobe.tsx`
- Modify: `src/features/mascot/components/MascotChip.tsx` (открытие), `src/features/mascot/index.ts`
- [ ] Неблокирующий лист/оверлей (стиль `ui/Overlay`): уровень + XP, превью `<Mascot/>`, сетка `COSMETICS` со слотами — разлоченные кликабельны (`useMascot.equip`), заблокированные затемнены с подписью «ур.N»; блок статуса помощников (доступен/кулдаун «снова завтра»). Цели тача ≥44pt; иконки+форма (не только цвет).
- [ ] Smoke: открыть из чипа, надеть/снять предмет — отражается на Капи и персистится. `npx tsc --noEmit`.
- [ ] commit `feat(mascot): гардероб — надевание косметики, статус помощников`

---

## Фаза F — Взаимодействие

### Task 15: Кормление + потеря/возврат
**Files:**
- Create: `src/features/mascot/components/FeedPrompt.tsx`, `src/features/mascot/components/SpeechBubble.tsx`
- Modify: `src/features/mascot/components/MascotLayer.tsx`, `src/features/game/store.ts` (хук возврата на `newGame`/старте)
- [ ] `FeedPrompt.tsx`: если `canFeed(lastFedDay, todayISO())` — над Капи мягко (не мигая) появляется иконка-блок; тап → `useMascot.feed()` → анимация «ам» + эмоция, бонус XP (возможен левел-ап/reveal). Без guilt: не покормил — Капи в `mood:'sad'` (чуть грустнее), без пушей.
- [ ] `SpeechBubble.tsx`: текстовый пузырь ТОЛЬКО для потери/интро; текст из i18n с учётом `praiseTone`.
- [ ] Потеря: в `MascotLayer` отпускание ниже пола/за пределы → анимация падения сквозь доску → `useMascot.drop()` + `SpeechBubble(mascotLost(tone,lang))`; Капи исчезает.
- [ ] Возврат: при `useGameStore.newGame()`/старте партии, если `lost` — `useMascot.recover()` и анимация входа с пуфом. (Подписка слоя на смену партии; XP/уровень сохранены.)
- [ ] Smoke: покормить (раз в день), уронить → «потерялся» → новая партия → вернулся. `npx tsc --noEmit`.
- [ ] commit `feat(mascot): ежедневное кормление + потеря при выбросе и возврат`

---

## Фаза G — Мягкие помощники (идеальный UI)

### Task 16: HelperHint + HelperSwap
**Files:**
- Create: `src/features/mascot/components/HelperHint.tsx`, `src/features/mascot/components/HelperSwap.tsx`
- Modify: `src/features/game/store.ts` (+ `replaceTrayPiece(trayIndex)` action + автосейв), `src/features/game/index.ts`
- [ ] `game/store.ts`: action `replaceTrayPiece(trayIndex)` — обёртка над `engine.replaceTrayPiece`, обновляет стейт + автосейв (как `placePiece`).
- [ ] `HelperHint` (разлок ур.5): доступен только при реальном «стаке» — эвристика по `findPlacements`/`hasPlacement` (мало валидных позиций у текущего трея) ИЛИ ручной тап по Капи в этом состоянии. Действие: Капи доходит до края, **показывает лапкой** валидную позицию из `findPlacements(board, shape)` → подсветка ghost-блоками (переиспользовать превью-подсветку drag-системы; **не делать ход за игрока**). После — `useMascot.useHelper('hint')` и индикатор кулдауна. **Идеальный UI:** не мигающий CTA, ноль ложных срабатываний, чёткий но ненавязчивый, цели ≥44pt.
- [ ] `HelperSwap` (разлок ур.12): доступен только если в трее есть `!hasPlacement(board, shape)`-фигура. Действие: Капи подходит к трею, забирает её → `game.replaceTrayPiece(i)` (свежая фигура). `useMascot.useHelper('swap')`. **Идеальный UI:** явная читаемая анимация «взял → новая появилась», **undo-тост ~1с**, кулдаун-индикатор, ноль случайных срабатываний.
- [ ] Оба недоступны при скрытом маскоте; уважение reduce-motion.
- [ ] Smoke: довести до «стака» → подсказка показывает реальный ход; непомещаемая фигура → унос + undo. `npm test` (на `replaceTrayPiece` action), `npx tsc --noEmit`.
- [ ] commit `feat(mascot): мягкие помощники — подсказка хода и унос непомещаемой фигуры`

---

## Фаза H — Интро, настройки, звук, доки

### Task 17: MascotIntro — первый заход
**Files:**
- Create: `src/features/mascot/components/MascotIntro.tsx`
- Modify: `src/features/mascot/components/MascotLayer.tsx`
- [ ] Триггер: старт **первой** партии при `!introDone` (не блокирует старт — 2 касания сохраняются). 4 неблокирующих beat'а (`mascotIntro(0..3, tone, lang)`): (1) спрыгивает с пуфом; (2) машет; (3) **после первой очистки** — XP-бар наполняется на глазах; (4) намёк на цель (силуэты→👑). Любой тап по экрану сворачивает; по завершении/скипу — `useMascot.markIntroDone()`. Работает оффлайн.
- [ ] Smoke: чистый профиль (сбросить `mascot.state`) → интро раз; второй заход — нет. `npx tsc --noEmit`.
- [ ] commit `feat(mascot): интро первого захода (неблокирующее, разовое)`

### Task 18: Настройка в Settings + локализация ярлыков
**Files:**
- Modify: `src/app/settings.tsx`, `src/core/i18n/ru.ts`, `src/core/i18n/en.ts`
- [ ] В `settings`-словари добавить `settings.showMascot` («Показывать Капи» / «Show Capi»). На экране Settings — тумблер рядом со звуком/вибро, вяжет `useSettings.update({showMascot})`.
- [ ] Smoke: выкл → слой/мозг/помощники не монтируются, прогресс сохраняется; вкл → возвращается с тем же уровнем. `npx tsc --noEmit`.
- [ ] commit `feat(settings): тумблер «Показывать Капи»`

### Task 19: Звук и хаптика «Капи»
**Files:**
- Modify: `scripts/gen-sounds.js`, `src/features/game/sound/sounds.ts` (реестр), мест вызовов в mascot-компонентах
- [ ] `gen-sounds.js`: добавить синтез `feed` (мягкий «ам»), `levelup` (короткая фанфара), `lost` (нисходящий блип), ≤50КБ каждый; перегенерировать ассеты.
- [ ] Подключить в реестр звуков; вызвать: кормление (impact light + feed), левел-ап (notification success + levelup), потеря (lost), тап (selection). Всё гейтится `sound`/`haptics` из настроек; не звучит во время drag.
- [ ] Smoke на устройстве/эмуляторе. `npx tsc --noEmit` → commit `feat(mascot): звук и хаптика (кормление/левел-ап/потеря)`

### Task 20: Правки смежных спек (синхронизация документации)
**Files:**
- Modify: `docs/specs/01-screens.md`, `03-game-engine.md`, `04-design-system.md`, `05-monetization.md`, `06-audience.md`, `07-performance.md`
- [ ] Применить точечные правки из §20 спеки 09: 01 — слой Капи в зонах Game + тумблер в Settings + интро в первой партии; 03 — `replaceTrayPiece` + использование `findPlacements/hasPlacement`; 04 — палитра/анимации/эмоты Капи (View-композиция); 05 — будущие косметические паки (no P2W); **06 — исключение к принципу №4 (всегда-лёгкий ироничный голос маскота, только в 2 текст-моментах) + Капи в таблицу фишек v1**; 07 — правила рендера маскота + «ноль новых нативных зависимостей».
- [ ] commit `docs: синхронизация спек 01–07 с фичей маскота (09)`

---

## Покрытие спеки (self-review)
- §3 персонаж/стадии/тон → Task 1,10 (стадии), 8 (тон в текстах). §4 размещение/рендер → Task 9,10,12. §5 поведение → Task 4,11. §6 реактивность → Task 11. §7 прокачка/распаковка → Task 2,7,13. §8 косметика → Task 1,14. §9 помощники → Task 5,16. §10 взаимодействие → Task 12,15. §11 интро → Task 17. §12–13 архитектура/персист → Task 6,7. §14 i18n → Task 8. §15 настройки/доступность → Task 18 (+ reduce-motion в 11,12,16). §16 звук → Task 19. §17 перф → сквозные правила (11,12) + §20 (Task 20). §18 монетизация (future) → доком (Task 20). §19 тесты → Task 1–8. §20 правки спек → Task 20. §21 граничные случаи → Task 7 (lost/feed/midnight),12,15,17.
- Числа уровней/наград/весов — черновые в `MASCOT_CONFIG`, балансируются без кода (как `GameConfig`).
