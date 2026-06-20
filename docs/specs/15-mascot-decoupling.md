# 15 — Mascot decoupling (отвязка Капи от уровней)

Статус: черновик на ревью · Обновлено: 2026-06-20
Родитель: [10-progression.md](10-progression.md) · Связь: [09-mascot](09-mascot.md) (базовая спека маскота), [11-progression-core](11-progression-core.md) (источник уровня/наград), [14-daily-bonus](14-daily-bonus.md) (доставка/заряды).

Рефактор `features/mascot`: убрать собственную XP-полоску и владение прогрессией. Капи становится спутником-витриной: стадия выводится из **Уровня Игры**, косметика приходит из progression (награды уровней) и дейли (дропы). Поведение/реакции/потеря/гардероб/интро — без изменений.

## 1. Scope

- Удалить XP/level из стейта и логики маскота; перенести владение уровнями/наградами/стадиями в `features/progression` (11).
- Заменить `feed()`-XP на доставку дейли (14); добавить заряды помощников.
- Сохранить публичный контракт для разлока косметики извне.
- **Не** входит: сама кривая (11), дейли (14).

## 2. Дифф состояния (`logic/types.ts`)

```ts
interface MascotState {
  // — totalXp        (удалить → переезжает в progression.lifetimePoints, 11 §7)
  // — level          (удалить → progression.level)
  // — lastFedDay     (удалить → daily.lastClaimDay, 14 §5)
  unlocked: string[];                                  // остаётся (владелец гардероба)
  equipped: Partial<Record<Slot, string>>;             // остаётся
  helpersUsedDay: Partial<Record<HelperId, string>>;   // остаётся
  helperCharges: Partial<Record<HelperId, number>>;    // НОВОЕ (заряды из дроп-дейли, 14)
  lost: boolean;                                        // остаётся
  introDone: boolean;                                   // остаётся
  rngState: number;                                     // остаётся (поведение)
}
```
`Stage` переезжает в `progression/logic/types.ts`; `mascot` импортирует его оттуда (направление `mascot → progression`, 02). `Slot`, `HelperId`, `Cosmetic`, эмоты/действия остаются в маскоте.

## 3. Дифф логики

- **`logic/progression.ts` (mascot) — удалить.** `stageForLevel`/`progressFor`/`rewardForLevel` живут в `features/progression` (11 §4). Стадия рендера Капи: `progression.stageForLevel(progression.level)`.
- **`logic/config.ts` (mascot):** удалить `maxLevel`, `stageBounds`, `rewards`, `xpToNext` (всё в 11). Оставить `actions`, `blink`, `nightHour`. `helpers`: оставить `stuckThreshold` (эвристика подсказки); `unlockLevel` помощников теперь задаётся `progression.levelRewards` (kind `helper`) — гейт читается из progression (`isHelperUnlocked(helper, level)`), не из `MASCOT_CONFIG`.
- **`logic/rules.ts`:** `canFeed` удалить (дейли владеет забором, 14). `canUseHelper(usedDay, today, gameLevel, helper, charges)` → `isHelperUnlocked(helper, gameLevel) && (usedDay !== today || (charges ?? 0) > 0)`.

## 4. Дифф стора (`store.ts`)

- **Удалить:** `applyScore`, `gainXp`, `unlockedThroughLevel`-расчёт от своего уровня, level-up `reveal` (level-up reveal теперь у координатора 11/`useProgressionSync`; маскот только применяет косметику).
- **Заменить `feed()`** → удалить XP-логику; дейли (14) владеет `claim()`. Для флейвора поедания — transient `playEat()` (анимация, не персист).
- **Добавить публичные:**
  - `unlock(id: string)` — идемпотентно добавить косметику в `unlocked` (вызывают координатор 11 для наград уровней и дейли 14 для дропов).
  - `addHelperCharge(helper: HelperId)` — `helperCharges[helper] = (…)+1`.
- **Изменить `useHelper(id)`** — если `usedDay===today` и `charges>0` → потратить заряд (`helperCharges[id]--`); иначе пометить `helpersUsedDay[id]=today`. Гейт уровня — из progression.
- **Оставить:** `drop`, `recover`, `equip`, `unequip`, `markIntroDone`, `bumpRng`.
- **`buildInitial`:** убрать пересчёт `level` из `totalXp`; `equipped` нормализуется по `unlocked` (как сейчас). Сверку `unlocked` с достигнутым уровнем делает координатор на маунте (см. §5), а не свой level.

## 5. Координация разлока (без обратной зависимости)

- `progression` **не импортирует** `mascot`. Мост — `useProgressionSync` (11 §6): на маунте и на каждом ап-е проходит косметические награды до текущего уровня и зовёт `mascot.unlock(id)` (идемпотентно) — так свежая установка на уровне N получает положенную косметику.
- Дейли (14) зовёт `mascot.unlock`/`mascot.addHelperCharge` напрямую (`dailybonus → mascot` разрешено).

## 6. Миграция

- `progression.lifetimePoints = mascot.totalXp` (если был), затем удалить `totalXp/level` из персиста маскота (11 §7).
- `daily.lastClaimDay = mascot.lastFedDay` (чтобы покормивший сегодня не забрал дейли дважды).
- `helperCharges` инициализируется `{}`.
- Защитный пересчёт/сверка на старте.

## 7. Тесты

- Обновить mascot-тесты: убрать сценарии XP/feed-XP; добавить `unlock` (идемпотентность), `addHelperCharge`, расход заряда в `useHelper`, гейт помощника от игрового уровня.
- Стадия Капи берётся из игрового уровня (через progression) — рендер-контракт стадий не сломан.
- Поведение (`behavior.test`) и косметика — без регрессий.
- Координатор: сверка `unlocked` с уровнем на маунте; применение наград на ап-е.
- `tsc --noEmit` + `npm test` зелёные.

## 8. Влияние на смежные спеки

- **09:** §7 (прокачка/XP) маскота заменяется ссылкой на 11; §10.2 (кормление) — на 14; стадии — производны от Уровня Игры; помощники — гейт по игровому уровню.
- **02:** направление `mascot → progression`; `Stage` в `progression/types`.
- **11/14:** потребитель уровня/наград и дейли-доставки.
