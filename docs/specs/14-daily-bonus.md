# 14 — Daily bonus (дейли-бонус)

Статус: черновик на ревью · Обновлено: 2026-06-20
Родитель: [10-progression.md](10-progression.md) · Связь: [11-progression-core](11-progression-core.md) (очки), `features/streak` (стрик+защитник), [09-mascot](09-mascot.md)/[15-mascot-decoupling](15-mascot-decoupling.md) (доставка, заряды помощников), [06](06-audience.md) (анти-чеклист).

Суточный крючок возврата: раз в день игрок забирает награду = **бонус-очки в Уровень Игры × множитель стрика** (+ шанс на переменный дроп). Доставляет Капи («кормление»). Без guilt/FOMO, оффлайн.

## 1. Scope

- Конфиг + чистая логика расчёта дня (детерминированная).
- Защитник стрика (в `features/streak`).
- Экшен `claim` (раз в день) + начисление очков + применение дропа.
- UI: дейли-карточка на Home + reveal (blind-box).
- **Не** входит: кривая уровней (11), темы (12).

## 2. Конфиг

```ts
// features/dailybonus/logic/config.ts
export const DAILY_CONFIG = {
  basePoints: 500,                                        // ≈ половина медианной партии
  streakMultiplier: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],  // день 1..7+, потолок на 7
  dropChanceByStreak: [0.25, 0.28, 0.31, 0.35, 0.39, 0.42, 0.45],
  dropRarity: { helperCharge: 0.6, cosmetic: 0.3, rare: 0.1 }, // сумма = 1
  day7GuaranteedCosmetic: true,                          // на стрике, кратном 7 — гарантия косметики
  protectorPerDays: 7,                                   // 1 защитник на скользящие 7 дней
  dailyCosmeticPool: [/* id из mascot/cosmetics.ts, не пересекается с levelRewards (11) */],
  rarePool: [/* id редких скинов Капи */],
} as const;
```

## 3. Чистая логика дня (детерминированная)

```ts
// features/dailybonus/logic/reward.ts
export type DailyDrop =
  | { type: 'helperCharge'; helper: HelperId }
  | { type: 'cosmetic'; id: string }
  | { type: 'rare'; id: string }
  | null;

export interface DailyResult { points: number; multiplier: number; drop: DailyDrop; rngState: number; }

export function computeDaily(streakCount: number, rngState: number, cfg = DAILY_CONFIG): DailyResult;
```
Алгоритм (на `mulberry32` из `core/engine`, как поведение Капи в 09):
1. `dayIdx = clamp(streakCount,1,7) - 1`; `multiplier = streakMultiplier[dayIdx]`; `points = round(basePoints * multiplier)`.
2. `guaranteed = day7GuaranteedCosmetic && streakCount % 7 === 0` → дроп = cosmetic из `dailyCosmeticPool` (детерм. пик), вернуть.
3. иначе тянем `r∈[0,1)`: если `r < dropChanceByStreak[dayIdx]` → второй бросок по `dropRarity` → `helperCharge` (случайный из доступных по уровню) / `cosmetic` (пул) / `rare` (пул); иначе `drop = null`.
4. вернуть с обновлённым `rngState`.

Детерминированность по `rngState` → воспроизводимо в тестах.

## 4. Защитник стрика (в `features/streak`)

```ts
// StreakState += protectorLastUsedDay: string | null
export function canUseProtector(s: StreakState, today: string, perDays = 7): boolean;
export function bumpStreakWithProtector(prev: StreakState, today: string, perDays = 7): StreakState;
```
- `bumpStreakWithProtector` (вызывается из `markPlayedToday`): тот же день → без изменений; разрыв 1 день (diff===1) → `count+1`; **пропуск 1 дня (diff===2) и защитник доступен** → `count+1`, `protectorLastUsedDay = today` (израсходован, восстановится через `perDays`); иначе → reset к 1.
- **Без пушей/вины.** Прогресс (XP/уровни/косметика) при сбросе стрика не теряется.

## 5. Состояние/персист

```ts
interface DailyState { lastClaimDay: string | null; rngState: number; }  // KEYS.daily
// StreakState += protectorLastUsedDay
// MascotState += helperCharges: Partial<Record<HelperId, number>>  (см. 15)
```

## 6. Экшен claim

```ts
// features/dailybonus/store.ts
canClaim(): boolean;                 // daily.lastClaimDay !== todayISO()
claim(): DailyClaimPayload | null;   // null, если уже забрано сегодня
```
Поток `claim()`:
1. guard `canClaim`.
2. `streak = max(useStreak.visibleCount(), 1)` (живой стрик; если потерян/0 → день 1, ×1).
3. `res = computeDaily(streak, daily.rngState)`.
4. `addRes = progression.addPoints(res.points)` (может вызвать level-up'ы → войдут в reveal).
5. применить `res.drop`: `cosmetic`/`rare` → `mascot.unlock(id)`; `helperCharge` → `mascot.addHelperCharge(helper)`.
6. `daily.lastClaimDay = today`, `daily.rngState = res.rngState`, persist.
7. вернуть `{ points, multiplier, drop, addRes }` для reveal.

Очки и применение дропа — вне drag-пути. `mascot.*` вызывается напрямую (направление `dailybonus → mascot` разрешено, 10 §10).

## 7. Забор и связь со стриком

- **Холодный забор с Home:** база доступна по заходу (Капи встречает). Множитель берётся от текущего живого стрика, который растёт только реальной игрой (`markPlayedToday` → `bumpStreakWithProtector`). Открыл-тапнул-вышел не фармит цепочку.
- Кормление Капи (09 §10.2) = вход к тому же `claim()` из игры; одна выдача в день, две двери (Home-карточка / иконка над Капи).

## 8. UI

- **DailyCard (Home):** «день N · ×M», мини-лесенка 7 (заполнена до текущего дня стрика, день 7 — иконка-подарок), кнопка «Забрать».
  - Состояния: `available` (мягко подсвечена, без агрессивного мигания) → `claimed` (спокойная, «приходи завтра» + превью «завтра ×M+») → индикатор «🛟 цепочку прикрыли», если сработал защитник.
  - Ambient, как огонёк стрика; не попап; не появляется до первой партии (анти-чеклист 06).
- **DailyReveal:** переиспользует blind-box (`LevelUpReveal`, 09): коробка → Капи ест → очки летят в бар уровня («+500 ×2.0»), при дропе — предмет/заряд; ≤1.2с, скип тапом. Несколько level-up'ов из шага 4 — дайджестом.

## 9. Граничные случаи

- Полночь/таймзона → `todayISO` локально (как стрик/feed сейчас).
- Капи выключен → reveal нейтральной коробкой (без поедания), дроп/очки начисляются; ничего не теряется (10 §1.2).
- Стрик потерян (`visibleCount()===0`) → день 1, ×1; забор работает.
- MAX-мир/за `maxAuthoredLevel` → очки всё равно копятся; дропы продолжаются.
- Повторный `claim` в тот же день → `null` (идемпотентно).

## 10. Тесты

- `computeDaily`: детерминизм по seed; множитель и потолок ×2.5 на дне 7+; `points = round(base*mult)`; рост шанса дропа; распределение rarity на массе сидов ≈ конфиг; гарантия косметики при `streak%7===0`.
- `streak`: `bumpStreakWithProtector` (diff 0/1/2/>2), 1 защитник на `perDays`, восстановление; сброс не трогает прогресс.
- `dailybonus/store`: `claim` раз в день через границу полуночи; начисление очков в progression; применение каждого типа дропа; холодный забор использует живой стрик; `rngState` продвигается.
- `mascot`: `addHelperCharge`/расход заряда (совместно с 15).
- `tsc --noEmit` + `npm test` зелёные.

## 11. i18n

- `daily.*` (день N, множитель, «забрать», «приходи завтра», защитник, reveal). Нейтральный UI-тон; голос Капи не расширяем (09).

## 12. Влияние на смежные спеки

- **01:** дейли-карточка на Home (ambient).
- **02:** модуль `features/dailybonus`; ключ `daily.state`; правка `streak` (+защитник).
- **06:** задействован защитник стрика (v1.2); анти-чеклист соблюдён.
- **09/15:** `feed()` → дейли-доставка; `helperCharges` в маскоте.
- **11:** дейли вызывает `progression.addPoints`.
