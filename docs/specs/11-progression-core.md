# 11 — Progression core (Уровень Игры)

Статус: черновик на ревью · Обновлено: 2026-06-20
Родитель: [10-progression.md](10-progression.md) · Конвенции: [02](02-architecture.md), CLAUDE.md (core/логика — чистый TS, `tsc --noEmit` + `npm test` зелёные).

Стержень всей мета-прогрессии: единственная числовая прогрессия (Уровень Игры) выводится из накопленных очков; на её основе считаются миры и награды. Без UI (UI — в 12/13/14). Без импортов React/RN в `logic/`.

## 1. Scope

- Чистая логика: очки → уровень, уровень → мир, уровень → награда.
- Store `progression` (zustand + MMKV) + экшен `addPoints`.
- Координатор `useProgressionSync` (подписка на конец партии → `addPoints`).
- Миграция со старой XP-полоски Капи.
- **Не** входит: темы (12), экран карты (13), дейли (14), рефактор маскота (15).

## 2. Конфиг (данные, тюнятся без кода)

```ts
// features/progression/logic/config.ts
export interface ProgressionConfig {
  levelCost: { base: number; growth: number };        // cost(L) = round(base * growth^(L-1))
  tierGaps: number[];                                  // число уровней между мирами (авторское)
  maxAuthoredLevel: number;                            // дальше — soft-infinite, без новых миров
  evolutionAtWorld: Partial<Record<number, 1|2|3|4>>;  // world → стадия Капи (наследуется 15)
  levelRewards: Partial<Record<number, RewardCosmetic | RewardHelper>>; // мировые уровни выводятся, не дублируются
  worldThemeId: Partial<Record<number, string>>;       // world → id темы (каталог в 12)
}

export const PROGRESSION_CONFIG: ProgressionConfig = {
  levelCost: { base: 1000, growth: 1.16 },
  tierGaps: [5, 7, 9, 11, 14, 18, 22],                 // миры на уровнях 1,6,13,22,33,47,65
  maxAuthoredLevel: 64,
  evolutionAtWorld: { 1: 1, 2: 2, 4: 3, 6: 4 },
  worldThemeId: { 1: 'classic', 2: 'neon', 3: 'sunset', 4: 'mono', 5: 'aqua', 6: 'galaxy', 7: 'gold' },
  levelRewards: {
    1:  { kind: 'cosmetic', id: 'hat-casquette' },
    // 2 — пусто
    3:  { kind: 'cosmetic', id: 'face-glasses' },
    4:  { kind: 'cosmetic', id: 'acc-headphones' },
    5:  { kind: 'helper',   id: 'hint' },
    // 6 — граница мира 2 (тема + эволюция, выводится)
    // 7 — пусто
    8:  { kind: 'cosmetic', id: 'skin-mint' },
    9:  { kind: 'helper',   id: 'swap' },
    10: { kind: 'cosmetic', id: 'hat-panama' },
    // 11 — пусто
    12: { kind: 'cosmetic', id: 'face-sunglasses' },
    // 13 — граница мира 3
    14: { kind: 'cosmetic', id: 'acc-scarf' },
    // 15 — пусто
    16: { kind: 'cosmetic', id: 'skin-coral' },
    17: { kind: 'cosmetic', id: 'hat-beanie' },
    // 18 — пусто
    19: { kind: 'cosmetic', id: 'face-star-eyes' },
    20: { kind: 'cosmetic', id: 'acc-backpack' },
    // 21 — пусто
    // 22 — граница мира 4
  },
};
```

Косметические `id` совпадают с каталогом `features/mascot` (`cosmetics.ts`) — это **данные-ссылка**, не импорт (мост — координатор §6, направление `mascot → progression` сохраняется). Пустые уровни (нет ключа) намеренны — приз не на каждом уровне (10 §5).

## 3. Типы

```ts
// features/progression/logic/types.ts
export type Stage = 1 | 2 | 3 | 4;                 // определяется здесь; mascot импортирует отсюда (15)
export type HelperId = 'hint' | 'swap';

export interface RewardCosmetic { kind: 'cosmetic'; id: string }
export interface RewardHelper   { kind: 'helper';   id: HelperId }
export interface RewardWorld    { kind: 'world'; world: number; themeId: string; evolveStage?: Stage }
export type LevelReward = RewardCosmetic | RewardHelper | RewardWorld;

export interface ProgressInfo {
  level: number;
  world: number;
  pointsInLevel: number;   // очков накоплено внутри текущего уровня
  pointsToNext: number;    // очков до следующего уровня (всегда > 0; soft-infinite не замораживает)
}
```

## 4. Чистая логика

```ts
// logic/levels.ts
export function levelCost(level: number, cfg = PROGRESSION_CONFIG): number;   // cost L -> L+1, level>=1
export function thresholdForLevel(level: number, cfg?): number;               // сумма cost(1..level-1); reach-порог
export function levelForPoints(points: number, cfg?): number;                 // макс L: threshold(L) <= points
export function progressFor(points: number, cfg?): ProgressInfo;              // {level, world, pointsInLevel, pointsToNext}
```
- `levelCost` строго возрастает; `thresholdForLevel(1)===0`.
- `levelForPoints(thresholdForLevel(L)) === L` (инверсия точна на границах).
- Soft-infinite: за `maxAuthoredLevel` уровни считаются той же формулой (мир не растёт).

```ts
// logic/worlds.ts
export function worldStartLevels(cfg?): number[];           // [1,6,13,22,...] из tierGaps (накопительно)
export function worldForLevel(level: number, cfg?): number; // 1-based
export function isWorldStart(level: number, cfg?): boolean;
export function nextWorldLevel(level: number, cfg?): number | null; // ближайший мировой уровень > level, или null
```

```ts
// logic/rewards.ts
export function rewardForLevel(level: number, cfg?): LevelReward | null;
//  - isWorldStart(level) → RewardWorld { world, themeId: cfg.worldThemeId[world], evolveStage: cfg.evolutionAtWorld[world] }
//  - иначе cfg.levelRewards[level] (cosmetic|helper) или null (пусто)
export function rewardsBetween(fromLevelExcl: number, toLevelIncl: number, cfg?): LevelReward[];
//  для дайджеста нескольких ап-ов за партию (10 §19)
export function stageForLevel(level: number, cfg?): Stage;
//  стадия Капи: evolutionAtWorld по нарастанию до worldForLevel(level); наследуется 15
```

## 5. Store

```ts
// features/progression/store.ts
interface ProgressionState {
  lifetimePoints: number;
  level: number;            // кэш (= levelForPoints(lifetimePoints))
  world: number;            // кэш (= worldForLevel(level))
  unlockedThemes: string[]; // темы открытых миров (для 12)
  activeTheme: string;      // текущая тема (для 12; меняется авто на границе мира и вручную в Settings)
  claimedRewards: string[]; // выданные cosmetic/helper id — идемпотентность
}

interface AddPointsResult {
  fromLevel: number;
  toLevel: number;
  rewards: LevelReward[];        // rewardsBetween(fromLevel, toLevel)
  enteredWorld: number | null;   // если пересекли границу мира — индекс нового мира
}

interface ProgressionActions {
  addPoints(amount: number): AddPointsResult;   // amount>=0; пересчёт уровня/мира; обновление unlockedThemes/activeTheme
  setActiveTheme(id: string): void;             // только если id ∈ unlockedThemes (использует 12)
  pointsInLevel(): number;                      // селектор
  pointsToNext(): number;
  nextWorldAt(): number | null;                 // уровень следующего мира
}
```

- `addPoints` идемпотентен по очкам (просто прибавляет); награды за уровни, которые уже в `claimedRewards`, не дублируются. На границе мира: `unlockedThemes.push(themeId)`, `activeTheme = themeId` (авто-переключение), `enteredWorld` заполняется.
- Персист в `KEYS.progression` на каждое изменение. Тема и `claimedRewards` — часть стейта.
- **Init/защита:** `level`/`world` пересчитываются из `lifetimePoints`; `unlockedThemes` пересобирается из `world`; `activeTheme` валидируется (∈ unlockedThemes, иначе тема текущего мира) — по аналогии с `buildInitial`/`normalizeEquipped` в `mascot/store`.

## 6. Координатор синка очков

```ts
// features/progression/hooks/useProgressionSync.ts
//  - подписывается на useGameStore.finalResult (как маскот на lastEvent), вне drag-пути
//  - на конце партии: const res = progression.addPoints(finalResult.score)
//  - маппит res.rewards → mascot.unlock(id) для kind==='cosmetic' (мост, чтобы progression не импортировал mascot)
//  - отдаёт payload для reveal (level-up дайджест) и для празднования мира (res.enteredWorld → 12/13)
```
`features/game` остаётся независимым (импорта progression внутрь game нет); связь — подписка, как в 09.

## 7. Миграция со старого кода

- Старая XP Капи фактически = накопленный счёт (`mascot.applyScore(score)` добавлял `floor(score)`). При первом запуске новой версии: если есть `mascot.state.totalXp` и нет `progression.state` → `lifetimePoints = mascot.totalXp`, пересчитать уровень/мир/темы.
- `mascot.state.totalXp/level` после миграции игнорируются и удаляются (см. 15).
- `MASCOT_CONFIG.xpToNext` (`80·1.18^(L-1)`) и `mascot/logic/progression.ts` **заменяются** этим модулем (15 удаляет их из mascot).

## 8. Состояние/персист

- Новый ключ `KEYS.progression`. `KEYS.mascot`/`KEYS.streak` — без изменений здесь (правки в 14/15).

## 9. Граничные случаи

- `addPoints(0)` / отрицательное → клампим к 0, без эффекта.
- Несколько ап-ов за партию → `rewards = rewardsBetween(from,to)`; смена мира среди них фиксируется `enteredWorld` (последний пересечённый мир, если их >1 — крайне редко).
- За `maxAuthoredLevel` → уровни растут, `rewardForLevel` без `world`, `nextWorldLevel` = null.
- Битый/старый сейв → защитный пересчёт на init.

## 10. Тесты (`__tests__/`)

- `levels`: монотонность `levelCost`; `thresholdForLevel(1)===0`; инверсия `levelForPoints(threshold(L))===L` для L=1..50; `progressFor` (pointsInLevel/pointsToNext) на границах и внутри; soft-infinite за maxAuthored.
- `worlds`: `worldStartLevels` из разных `tierGaps`; `worldForLevel`/`isWorldStart`/`nextWorldLevel`; поведение за последним миром (null).
- `rewards`: `rewardForLevel` даёт `world` на границах с правильными themeId/evolveStage; cosmetic/helper по карте; null на пустых; `rewardsBetween` для мультиапа; `stageForLevel` монотонна.
- `store`: `addPoints` — пересчёт уровня/мира, `enteredWorld`, push темы и авто-`activeTheme`, идемпотентность `claimedRewards`; `setActiveTheme` guard; init-защита; миграция из `mascot.totalXp`.
- `tsc --noEmit` + `npm test` зелёные.

## 11. Влияние на смежные спеки

- **02:** новый модуль `features/progression`, ключ `progression.state`, координатор `useProgressionSync`, направление `mascot → progression`.
- **09/15:** `stageForLevel`/уровневые награды переезжают сюда; mascot их потребляет.
- **10:** реализует §2–5, §10–11 родителя.
