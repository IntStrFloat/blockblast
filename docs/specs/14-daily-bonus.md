# 14 — Daily bonus (дейли-бонус)

Статус: реализовано (retention фаза 1) · Обновлено: 2026-07-07
Родитель: [10-progression.md](10-progression.md) · Связь: [11-progression-core](11-progression-core.md) (очки), `features/streak` (стрик+защитник), [17-adventure-mode](17-adventure-mode.md) (цель дня), [09-mascot](09-mascot.md)/[15-mascot-decoupling](15-mascot-decoupling.md) (заряды помощников), [06](06-audience.md) (анти-чеклист).
Дизайн-решение: [docs/superpowers/specs/2026-07-07-retention-rework-design.md](../superpowers/specs/2026-07-07-retention-rework-design.md) §1.

Суточный крючок возврата: награда выдаётся **за игру, а не за открытие приложения**. Две ступени:

1. **Первая победа дня** (любой режим) → бонус-очки в Уровень Игры × множитель стрика.
2. **Цель дня Adventure** (`ADVENTURE_CONFIG.dailyGoalLevels` побед за день) → **гарантированный дроп** (заряд помощника / косметика / rare).

Без guilt/FOMO, оффлайн. Кнопки «забрать» нет — карточка на Home только показывает состояние дня.

## 1. Scope

- Конфиг + чистая логика расчёта (детерминированная).
- Защитник стрика (в `features/streak`).
- Экшены `claimFirstWin` / `claimDailyGoal` (идемпотентны в пределах дня) + `pendingCelebration`.
- UI: статус-карточка на Home, celebration-момент на экранах результата.
- **Не** входит: кривая уровней (11), темы (12), сама цель дня Adventure (17).

## 2. Конфиг

```ts
// features/dailybonus/logic/config.ts
export const DAILY_CONFIG = {
  basePoints: 500,                                        // ≈ половина медианной партии
  streakMultiplier: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],  // день 1..7+, потолок на 7
  dropRarity: { helperCharge: 0.6, cosmetic: 0.3, rare: 0.1 }, // сумма = 1 (внутри гарантированного дропа)
  day7GuaranteedCosmetic: true,                          // на стрике, кратном 7 — гарантия косметики
  protectorPerDays: 7,                                   // 1 защитник на скользящие 7 дней
  dailyCosmeticPool: [/* id из mascot/cosmetics.ts, не пересекается с levelRewards (11) */],
  rarePool: [/* id редких скинов Капи */],
  helperIds: ['hint', 'swap'],
} as const;
```

`dropChanceByStreak` удалён: дроп больше не случайный шанс при клейме, а гарантированная награда за цель дня.

## 3. Чистая логика (детерминированная)

```ts
// features/dailybonus/logic/reward.ts
export type DailyDrop = { type: 'helperCharge'; helper: HelperId } | { type: 'cosmetic'; id: string } | { type: 'rare'; id: string } | null;
export type DailyDropItem = Exclude<DailyDrop, null>;

// Ступень 1 (без rng): день/множитель/очки. computeFirstWin === dailyPreview.
export function dailyPreview(streakCount: number, cfg = DAILY_CONFIG): DailyPreview;
export const computeFirstWin = dailyPreview;

// Ступень 2: гарантированный дроп.
export function computeGoalDrop(streakCount: number, rngState: number, cfg = DAILY_CONFIG): { drop: DailyDropItem; rngState: number };
```

Алгоритм `computeGoalDrop` (на `mulberry32` из `core/engine`):
1. `day7GuaranteedCosmetic && streak % 7 === 0` → cosmetic из `dailyCosmeticPool` (детерм. пик), вернуть.
2. иначе бросок по `dropRarity` → `helperCharge` / `cosmetic` / `rare`; пустые пулы деградируют к `helperCharge`.
3. вернуть с обновлённым `rngState`.

## 4. Защитник стрика (в `features/streak`)

```ts
// StreakState += protectorLastUsedDay: string | null
export function canUseProtector(s: StreakState, today: string, perDays = 7): boolean;
export function bumpStreakWithProtector(prev: StreakState, today: string, perDays = 7): StreakState;
```
- `bumpStreakWithProtector` (вызывается из `markPlayedToday`): тот же день → без изменений; разрыв 1 день (diff===1) → `count+1`; **пропуск 1 дня (diff===2) и защитник доступен** → `count+1`, `protectorLastUsedDay = today` (израсходован, восстановится через `perDays`); иначе → reset к 1.
- **Без вины.** Прогресс (уровни/косметика) при сбросе стрика не теряется.

## 5. Состояние/персист

```ts
interface DailyState {
  lastClaimDay: string | null;      // ступень 1 (день первой победы)
  lastGoalClaimDay: string | null;  // ступень 2 (день выполнения цели)
  rngState: number;
}  // KEYS.daily
// + транзиентный pendingCelebration: DailyCelebration | null (не персистится)
```

Миграция: старый `lastClaimDay` (клейм по кнопке) сохраняется — повторной выдачи в день обновления нет; `lastGoalClaimDay` стартует `null`.

## 6. Экшены

```ts
// features/dailybonus/store.ts
firstWinClaimedToday(): boolean;
goalClaimedToday(): boolean;
claimFirstWin(): DailyCelebration | null;   // null, если уже забрано сегодня
claimDailyGoal(): DailyCelebration | null;  // null, если уже забрано сегодня
ackCelebration(): void;
```

Поток `claimFirstWin` (очки): guard → `streak = max(useStreak.visibleCount(), 1)` → `computeFirstWin` → `progression.addPoints(points)` → persist + `pendingCelebration` → аналитика `daily_bonus_stage {stage:'firstWin'}`.

Поток `claimDailyGoal` (дроп): guard → `computeGoalDrop` → `cosmetic`/`rare` → `mascot.unlock(id)`, `helperCharge` → `mascot.addHelperCharge(helper)` → persist + `pendingCelebration` → аналитика `daily_bonus_stage {stage:'goal'}`.

Очки и дроп — вне drag-пути. `mascot.*` вызывается напрямую (направление `dailybonus → mascot` разрешено, 10 §10). **dailybonus не импортирует adventure** (иначе цикл game→dailybonus→adventure→game): прогресс цели приходит в UI пропсами с Home.

## 7. Точки вызова (кто выдаёт)

- **Классика** (`game/store.ts`, ветка game over, только `firstCompletion`): «победа» = завершённая партия с ≥1 очищенной линией → `claimFirstWin()` (после `markPlayedToday`, чтобы множитель взял сегодняшний стрик).
- **Adventure** (`app/adventure-level.tsx`, ветка won): `markPlayedToday()` (победа поддерживает стрик наравне с классикой) → `claimFirstWin()` → при `dailyCleared === dailyGoalLevels` — аналитика `adventure_daily_goal_done`; при `>=` — `claimDailyGoal()`.
- Кормление Капи — чисто косметический жест (клейма больше нет); дверь показывается, пока ступень 1 не заработана.

## 8. UI

- **DailyCard (Home)** — статус дня, без кнопки: «день N · ×M», мини-лесенка 7, строка ступени 1 («Выиграй партию → +N» / «✓ +N забрано»), строка ступени 2 («🎁 Цель дня в Приключении: 3/5» / «✓ награда получена», тап → /adventure), «🛟 цепочку прикрыли» при защитнике. Ambient; не появляется до первой партии (анти-чеклист 06). Прогресс цели приходит пропсом `goal` с Home.
- **DailyBonusMoment** — celebration-блок на экранах результата (GameOverOverlay, LevelResultView): показывает `pendingCelebration` («Дневной бонус! +625 ×1.25 · день 2» / «🎁 Цель дня выполнена! + тип дропа»), гасит его при размонтировании. Reanimated, вне drag-пути.
- **AdventureEntryCard** — мини-прогресс цели дня («Сегодня: 3/5» + 🎁 / галочка).

## 9. Граничные случаи

- Полночь/таймзона → `todayISO` локально (как стрик сейчас).
- Стрик потерян (`visibleCount()===0`) → день 1, ×1; выдача работает.
- Ревайв: учёт заморожен на первом game over (`firstCompletion`) — повторной выдачи нет.
- Game over без единой линии → ступень 1 не выдаётся (партия не «победа»).
- Ступени независимы: цель дня можно выполнить и до первой победы в классике.
- Повторный клейм в тот же день → `null` (идемпотентно).

## 10. Тесты

- `reward`: `computeFirstWin` (множитель, потолок, clamp дня); `computeGoalDrop` (детерминизм, гарантированность, day7-косметика, распределение rarity на массе сидов, id из пулов).
- `store`: оба клейма раз в день; начисление очков в progression; применение каждого типа дропа; живой стрик для множителя; `rngState` продвигается; независимость ступеней; `ackCelebration`.
- `game/store`: выдача на game over с линиями; невыдача без линий; невыдача на ревайв-финале.
- `homeDailyMap`: карточка — статус без `.claim(`, Home передаёт `goal` и роутит в /adventure.

## 11. i18n

- `daily.*`: `momentTitle`, `momentGoal`, `playForBonus`, `collected`, `goalProgress`, `goalDone`, `today`, `protected`, `dropItem`, `dropCharge`. Ключи `claim`/`comeBack`/`tomorrow` удалены.

## 12. Влияние на смежные спеки

- **01:** DailyCard-статус на Home; DailyBonusMoment на Game Over.
- **02:** модуль `features/dailybonus`; ключ `daily.state` (+`lastGoalClaimDay`).
- **06:** без принуждения: награда за игру, максимум мягкий статус на Home.
- **09/15:** кормление — косметика; `helperCharges` в маскоте.
- **11:** ступень 1 вызывает `progression.addPoints`.
- **17:** цель дня = 5 уровней; выполнение выдаёт ступень 2.
