# Дейли-цикл за игру (retention фаза 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дейли-бонус выдаётся за игру (ступень 1 — первая победа дня в любом режиме, ступень 2 — 5 уровней Adventure в день с гарантированным дропом), а не за открытие приложения.

**Architecture:** `features/dailybonus` перестраивается на два идемпотентных клейма (`claimFirstWin`/`claimDailyGoal`) с транзиентным `pendingCelebration`; хуки вызова — в game store (game over классики) и в `app/adventure-level.tsx` (победа уровня). UI: celebration-блок `DailyBonusMoment` на экранах результата, `DailyCard` на Home становится статусом дня (прогресс цели приходит пропсами с Home — чтобы не создать цикл game→dailybonus→adventure→game), `AdventureEntryCard` получает строку «Сегодня: N/5».

**Tech Stack:** TypeScript strict, zustand, MMKV (`core/storage`), Reanimated, Jest. Спека: `docs/superpowers/specs/2026-07-07-retention-rework-design.md` §1.

**Конвенции (CLAUDE.md):** `npx tsc --noEmit` и `npm test` зелёные перед каждым коммитом; строки — через `core/i18n` (ru/en); текст — только `AppText`; цвета — из `ui/theme.ts`; игровые числа — в конфигах.

---

### Task 1: Reward-логика — computeFirstWin / computeGoalDrop

**Files:**
- Modify: `src/features/dailybonus/logic/config.ts`
- Modify: `src/features/dailybonus/logic/reward.ts`
- Create: `src/features/dailybonus/__tests__/reward.test.ts`

- [ ] **Step 1.1: Написать падающие тесты reward-логики**

Создать `src/features/dailybonus/__tests__/reward.test.ts`:

```ts
import { DAILY_CONFIG } from '../logic/config';
import { computeFirstWin, computeGoalDrop, dailyPreview } from '../logic/reward';

describe('computeFirstWin', () => {
  it('очки = base × множитель дня стрика', () => {
    expect(computeFirstWin(1)).toEqual({ day: 1, multiplier: 1, points: 500 });
    expect(computeFirstWin(2)).toEqual({ day: 2, multiplier: 1.25, points: 625 });
    expect(computeFirstWin(7)).toEqual({ day: 7, multiplier: 2.5, points: 1250 });
  });

  it('стрик выше потолка лесенки держит последний множитель', () => {
    expect(computeFirstWin(20).multiplier).toBe(2.5);
  });

  it('нулевой/отрицательный стрик считается днём 1', () => {
    expect(computeFirstWin(0).day).toBe(1);
    expect(computeFirstWin(-3).day).toBe(1);
  });
});

describe('computeGoalDrop', () => {
  it('дроп всегда есть (гарантированный)', () => {
    let rng = 12345;
    for (let i = 0; i < 50; i += 1) {
      const result = computeGoalDrop(3, rng);
      expect(result.drop).not.toBeNull();
      rng = result.rngState;
    }
  });

  it('на стрике, кратном 7, дроп — гарантированная косметика из дневного пула', () => {
    const result = computeGoalDrop(7, 42);
    expect(result.drop.type).toBe('cosmetic');
    expect(DAILY_CONFIG.dailyCosmeticPool).toContain((result.drop as { id: string }).id);
  });

  it('rngState продвигается (последовательные вызовы дают разные состояния)', () => {
    const a = computeGoalDrop(2, 42);
    expect(a.rngState).not.toBe(42);
  });

  it('типы дропа — только helperCharge/cosmetic/rare', () => {
    let rng = 777;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const result = computeGoalDrop(2, rng);
      seen.add(result.drop.type);
      rng = result.rngState;
    }
    for (const type of seen) {
      expect(['helperCharge', 'cosmetic', 'rare']).toContain(type);
    }
  });
});

describe('dailyPreview', () => {
  it('не изменился: день/множитель/очки для UI', () => {
    expect(dailyPreview(2)).toEqual({ day: 2, multiplier: 1.25, points: 625 });
  });
});
```

- [ ] **Step 1.2: Запустить — убедиться, что падают**

Run: `npx jest src/features/dailybonus/__tests__/reward.test.ts`
Expected: FAIL — `computeFirstWin`/`computeGoalDrop` не экспортированы.

- [ ] **Step 1.3: Реализация — config без dropChanceByStreak**

В `src/features/dailybonus/logic/config.ts` удалить поле `dropChanceByStreak` из интерфейса и значения (дроп теперь гарантирован за цель дня, шанс не нужен):

```ts
export interface DailyConfig {
  /** База бонус-очков (≈ половина медианной партии). */
  basePoints: number;
  /** Множитель по дню стрика (1..7+), последний — потолок. */
  streakMultiplier: number[];
  /** Доли типов внутри гарантированного дропа за цель дня (сумма = 1). */
  dropRarity: { helperCharge: number; cosmetic: number; rare: number };
  /** Гарантировать косметику на стрике, кратном 7. */
  day7GuaranteedCosmetic: boolean;
  /** Период восстановления защитника стрика (дней). */
  protectorPerDays: number;
  /** Дневной пул косметики (id из mascot/cosmetics.ts, не пересекается с PROGRESSION_CONFIG.levelRewards). */
  dailyCosmeticPool: string[];
  /** Редкие скины Капи (id из mascot/cosmetics.ts). */
  rarePool: string[];
  /** Помощники, заряд которых может выпасть. */
  helperIds: HelperId[];
}

export const DAILY_CONFIG: DailyConfig = {
  basePoints: 500,
  streakMultiplier: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
  dropRarity: { helperCharge: 0.6, cosmetic: 0.3, rare: 0.1 },
  day7GuaranteedCosmetic: true,
  protectorPerDays: 7,
  dailyCosmeticPool: ['hat-block-crown', 'face-monocle', 'skin-chrome', 'acc-cape'],
  rarePool: ['hat-halo'],
  helperIds: ['hint', 'swap'],
};
```

(Пересечение `dailyCosmeticPool` с призами турнира чинится в фазе 3 — здесь пул не трогаем.)

- [ ] **Step 1.4: Реализация — reward.ts**

Заменить содержимое `src/features/dailybonus/logic/reward.ts` (убрать `computeDaily`, добавить две функции; `dailyPreview` и типы остаются):

```ts
import { rngNext } from '@/core/engine';
import type { HelperId } from '@/features/progression';

import { DAILY_CONFIG, type DailyConfig } from './config';

export type DailyDrop =
  | { type: 'helperCharge'; helper: HelperId }
  | { type: 'cosmetic'; id: string }
  | { type: 'rare'; id: string }
  | null;

/** Ненулевой дроп — гарантированная награда за цель дня. */
export type DailyDropItem = Exclude<DailyDrop, null>;

export interface DailyPreview {
  /** День стрика, ограниченный потолком (1..len). */
  day: number;
  multiplier: number;
  points: number;
}

/**
 * Превью/расчёт ступени 1 (первая победа дня): день/множитель/бонус-очки.
 * Чистая функция без rng — дропа на ступени 1 нет.
 */
export function dailyPreview(streakCount: number, cfg: DailyConfig = DAILY_CONFIG): DailyPreview {
  const day = Math.min(Math.max(streakCount, 1), cfg.streakMultiplier.length);
  const multiplier = cfg.streakMultiplier[day - 1];
  return { day, multiplier, points: Math.round(cfg.basePoints * multiplier) };
}

/** Ступень 1: та же математика, семантичное имя для клейма. */
export const computeFirstWin = dailyPreview;

function pick<T>(arr: readonly T[], r: number): T {
  return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
}

export interface GoalDropResult {
  drop: DailyDropItem;
  rngState: number;
}

/**
 * Ступень 2 (цель дня Adventure): гарантированный дроп.
 * На живом стрике, кратном 7, — косметика из дневного пула; иначе рулетка
 * helperCharge/cosmetic/rare по cfg.dropRarity. Пустые пулы деградируют к helperCharge.
 */
export function computeGoalDrop(
  streakCount: number,
  rngState: number,
  cfg: DailyConfig = DAILY_CONFIG,
): GoalDropResult {
  if (
    cfg.day7GuaranteedCosmetic &&
    streakCount > 0 &&
    streakCount % 7 === 0 &&
    cfg.dailyCosmeticPool.length > 0
  ) {
    const r = rngNext(rngState);
    return { drop: { type: 'cosmetic', id: pick(cfg.dailyCosmeticPool, r.value) }, rngState: r.state };
  }

  const rarity = rngNext(rngState);
  const { helperCharge, cosmetic } = cfg.dropRarity;

  if (rarity.value < helperCharge && cfg.helperIds.length > 0) {
    const p = rngNext(rarity.state);
    return { drop: { type: 'helperCharge', helper: pick(cfg.helperIds, p.value) }, rngState: p.state };
  }
  if (rarity.value < helperCharge + cosmetic && cfg.dailyCosmeticPool.length > 0) {
    const p = rngNext(rarity.state);
    return { drop: { type: 'cosmetic', id: pick(cfg.dailyCosmeticPool, p.value) }, rngState: p.state };
  }
  if (cfg.rarePool.length > 0) {
    const p = rngNext(rarity.state);
    return { drop: { type: 'rare', id: pick(cfg.rarePool, p.value) }, rngState: p.state };
  }
  // Деградация: все пулы пусты, кроме помощников.
  const p = rngNext(rarity.state);
  return { drop: { type: 'helperCharge', helper: pick(cfg.helperIds, p.value) }, rngState: p.state };
}
```

- [ ] **Step 1.5: Запустить тесты reward**

Run: `npx jest src/features/dailybonus/__tests__/reward.test.ts`
Expected: PASS (тесты store/index пока красные — это следующие задачи; коммит в конце Task 2).

### Task 2: Store — два клейма и pendingCelebration

**Files:**
- Modify: `src/features/dailybonus/store.ts`
- Modify: `src/features/dailybonus/__tests__/store.test.ts`
- Modify: `src/features/dailybonus/index.ts`
- Modify: `src/features/analytics/types.ts`

- [ ] **Step 2.1: Обновить события аналитики**

В `src/features/analytics/types.ts` заменить строку `daily_bonus_claimed: { points: number; multiplier: number; dropType: string };` на:

```ts
  daily_bonus_stage:
    | { stage: 'firstWin'; points: number; multiplier: number; day: number }
    | { stage: 'goal'; dropType: string };
  adventure_daily_goal_done: { cleared: number };
```

- [ ] **Step 2.2: Переписать тесты store (сначала — они падают)**

Существующий `src/features/dailybonus/__tests__/store.test.ts` переписать под новое API. Сохранить локальные моки/сбросы из текущего файла (если там есть `beforeEach` с очисткой MMKV/сторов — оставить его каркас), заменить кейсы на:

```ts
import { useDailyBonus } from '../store';
import { useStreak, todayISO } from '@/features/streak';
import { useProgression } from '@/features/progression';

// ...существующий каркас моков/beforeEach остаётся...

describe('useDailyBonus (двухступенчатый)', () => {
  it('claimFirstWin начисляет base×множитель один раз в день', () => {
    const before = useProgression.getState().lifetimePoints;
    const first = useDailyBonus.getState().claimFirstWin();
    expect(first).toEqual({ kind: 'firstWin', points: 500, multiplier: 1, day: 1 });
    expect(useProgression.getState().lifetimePoints - before).toBe(500);
    expect(useDailyBonus.getState().claimFirstWin()).toBeNull(); // идемпотентность
    expect(useDailyBonus.getState().pendingCelebration?.kind).toBe('firstWin');
  });

  it('claimFirstWin использует живой стрик для множителя', () => {
    // стрик 2: вчера+сегодня
    useStreak.setState({ lastDay: todayISO(), count: 2 });
    const first = useDailyBonus.getState().claimFirstWin();
    expect(first).toMatchObject({ points: 625, multiplier: 1.25, day: 2 });
  });

  it('claimDailyGoal даёт гарантированный дроп один раз в день', () => {
    const goal = useDailyBonus.getState().claimDailyGoal();
    expect(goal?.kind).toBe('goal');
    expect(goal && goal.kind === 'goal' ? goal.drop : null).not.toBeNull();
    expect(useDailyBonus.getState().claimDailyGoal()).toBeNull();
  });

  it('ackCelebration очищает pendingCelebration', () => {
    useDailyBonus.getState().claimFirstWin();
    useDailyBonus.getState().ackCelebration();
    expect(useDailyBonus.getState().pendingCelebration).toBeNull();
  });

  it('миграция: lastClaimDay сегодня по-старому блокирует ступень 1', () => {
    // Каркас: перед созданием стора записать в MMKV KEYS.daily { lastClaimDay: todayISO(), rngState: 1 }
    // (как делает текущий тест миграции с mascot.lastFedDay — переиспользовать паттерн)
  });
});
```

Тест миграции реализовать по образцу существующего теста миграции `savedMascot.lastFedDay` из текущего файла (он уже настраивает MMKV до `jest.isolateModules`-подгрузки стора).

- [ ] **Step 2.3: Запустить — убедиться, что падают**

Run: `npx jest src/features/dailybonus/__tests__/store.test.ts`
Expected: FAIL — `claimFirstWin` не существует.

- [ ] **Step 2.4: Переписать store**

Заменить содержимое `src/features/dailybonus/store.ts`:

```ts
import { create } from 'zustand';

import { seedFromTime } from '@/core/engine';
import { KEYS, getJSON, setJSON } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';
import { useMascot } from '@/features/mascot/store';
import { useProgression } from '@/features/progression';
import { todayISO, useStreak } from '@/features/streak';

import { DAILY_CONFIG } from './logic/config';
import { computeFirstWin, computeGoalDrop, type DailyDropItem } from './logic/reward';

interface DailyState {
  /** День (YYYY-MM-DD), когда забрана ступень 1 — «первая победа дня». */
  lastClaimDay: string | null;
  /** День, когда забрана ступень 2 — «цель дня» Adventure. */
  lastGoalClaimDay: string | null;
  rngState: number;
}

/** Транзиентный celebration-момент для экранов результата (не персистится). */
export type DailyCelebration =
  | { kind: 'firstWin'; points: number; multiplier: number; day: number }
  | { kind: 'goal'; drop: DailyDropItem };

interface DailyStore extends DailyState {
  pendingCelebration: DailyCelebration | null;
  firstWinClaimedToday: () => boolean;
  goalClaimedToday: () => boolean;
  /** Ступень 1: первая победа дня (любой режим). Идемпотентна в пределах дня. */
  claimFirstWin: () => DailyCelebration | null;
  /** Ступень 2: выполнена дейли-цель Adventure. Идемпотентна в пределах дня. */
  claimDailyGoal: () => DailyCelebration | null;
  ackCelebration: () => void;
}

const saved = getJSON<Partial<DailyState>>(KEYS.daily);
// Миграция (спека 15 §6): покормивший Капи сегодня (старый mascot.lastFedDay) не должен
// забрать дейли повторно — переносим день забора, если своего ещё нет.
const savedMascot = getJSON<{ lastFedDay?: string | null }>(KEYS.mascot);

function persist(state: DailyState): void {
  setJSON(KEYS.daily, state);
}

export const useDailyBonus = create<DailyStore>((set, get) => ({
  lastClaimDay: saved?.lastClaimDay ?? savedMascot?.lastFedDay ?? null,
  lastGoalClaimDay: saved?.lastGoalClaimDay ?? null,
  rngState: saved?.rngState ?? seedFromTime(),
  pendingCelebration: null,

  firstWinClaimedToday: () => get().lastClaimDay === todayISO(),
  goalClaimedToday: () => get().lastGoalClaimDay === todayISO(),

  claimFirstWin() {
    const today = todayISO();
    if (get().lastClaimDay === today) return null;

    // Живой стрик; если потерян/0 — день 1 (×1). Множитель растёт только реальной игрой.
    const streak = Math.max(useStreak.getState().visibleCount(), 1);
    const { points, multiplier, day } = computeFirstWin(streak, DAILY_CONFIG);
    useProgression.getState().addPoints(points);

    const next: DailyState = {
      lastClaimDay: today,
      lastGoalClaimDay: get().lastGoalClaimDay,
      rngState: get().rngState,
    };
    const celebration: DailyCelebration = { kind: 'firstWin', points, multiplier, day };
    set({ ...next, pendingCelebration: celebration });
    persist(next);
    useAnalyticsStore.getState().track('daily_bonus_stage', {
      stage: 'firstWin',
      points,
      multiplier,
      day,
    });
    return celebration;
  },

  claimDailyGoal() {
    const today = todayISO();
    if (get().lastGoalClaimDay === today) return null;

    const streak = Math.max(useStreak.getState().visibleCount(), 1);
    const result = computeGoalDrop(streak, get().rngState, DAILY_CONFIG);

    const drop = result.drop;
    if (drop.type === 'cosmetic' || drop.type === 'rare') {
      useMascot.getState().unlock(drop.id);
    } else {
      useMascot.getState().addHelperCharge(drop.helper);
    }

    const next: DailyState = {
      lastClaimDay: get().lastClaimDay,
      lastGoalClaimDay: today,
      rngState: result.rngState,
    };
    const celebration: DailyCelebration = { kind: 'goal', drop };
    set({ ...next, pendingCelebration: celebration });
    persist(next);
    useAnalyticsStore.getState().track('daily_bonus_stage', { stage: 'goal', dropType: drop.type });
    return celebration;
  },

  ackCelebration: () => set({ pendingCelebration: null }),
}));
```

- [ ] **Step 2.5: Обновить public API модуля**

`src/features/dailybonus/index.ts`:

```ts
export { DAILY_CONFIG } from './logic/config';
export type { DailyConfig } from './logic/config';
export { computeFirstWin, computeGoalDrop, dailyPreview } from './logic/reward';
export type { DailyDrop, DailyDropItem, DailyPreview, GoalDropResult } from './logic/reward';
export { useDailyBonus } from './store';
export type { DailyCelebration } from './store';
export { DailyCard } from './components/DailyCard';
export { DailyBonusMoment } from './components/DailyBonusMoment';
```

(`DailyBonusMoment` создаётся в Task 5 — до него строка экспорта будет красной; если выполняешь задачи строго по одной с зелёным tsc, добавь эту строку экспорта в Task 5, а здесь — остальные.)

- [ ] **Step 2.6: Прогнать тесты и типы**

Run: `npx jest src/features/dailybonus && npx tsc --noEmit`
Expected: тесты dailybonus PASS; tsc покажет ошибки в потребителях старого API (`DailyCard`, старые события) — они чинятся в Task 3–6. Если выполняешь план последовательно, коммит — после Task 6, когда tsc зелёный. Промежуточно коммитить нельзя (правило: tsc зелёный перед коммитом).

### Task 3: Хук классики — claimFirstWin на game over

**Files:**
- Modify: `src/features/game/store.ts` (ветка `result.event.gameOver` в `placePiece`, ~строки 326–357)
- Modify: `src/features/game/__tests__/store.test.ts`

- [ ] **Step 3.1: Тест (падающий)**

В `src/features/game/__tests__/store.test.ts` рядом с существующим тестом стрика на game over (там, где `expect(useStreak.getState().count).toBe(1)`) добавить, переиспользуя тот же сценарий доигрывания до game over:

```ts
it('game over с ≥1 линией забирает дейли-бонус ступени 1', () => {
  // тот же сценарий, что в тесте стрика: партия доигрывается до game over с очищенными линиями
  // ...
  expect(useDailyBonus.getState().firstWinClaimedToday()).toBe(true);
});

it('game over без единой линии не забирает дейли-бонус', () => {
  // сценарий game over при linesCleared === 0 (заполнить доску без клира)
  // ...
  expect(useDailyBonus.getState().firstWinClaimedToday()).toBe(false);
});
```

Импорт: `import { useDailyBonus } from '@/features/dailybonus';`. Перед каждым тестом сбрасывать состояние: `useDailyBonus.setState({ lastClaimDay: null, lastGoalClaimDay: null, pendingCelebration: null });`.

- [ ] **Step 3.2: Запустить — FAIL**

Run: `npx jest src/features/game/__tests__/store.test.ts -t "дейли-бонус"`
Expected: FAIL.

- [ ] **Step 3.3: Реализация**

В `src/features/game/store.ts` добавить импорт `import { useDailyBonus } from '@/features/dailybonus';` и в ветке gameOver заменить:

```ts
        if (firstCompletion) {
          useStreak.getState().markPlayedToday();
        }
```

на:

```ts
        if (firstCompletion) {
          useStreak.getState().markPlayedToday();
          // Ступень 1 дейли-бонуса: «победа» в классике = завершённая партия
          // с ≥1 очищенной линией. После markPlayedToday — чтобы множитель
          // взял уже сегодняшний стрик.
          if (lines >= 1) {
            useDailyBonus.getState().claimFirstWin();
          }
        }
```

- [ ] **Step 3.4: Запустить — PASS**

Run: `npx jest src/features/game/__tests__/store.test.ts`
Expected: PASS.

### Task 4: Хук Adventure — победа уровня, цель дня 5, стрик

**Files:**
- Modify: `src/features/adventure/logic/config.ts` (`dailyGoalLevels: 10` → `5`)
- Modify: `src/app/adventure-level.tsx` (ветка `runStatus === 'won'`, ~строки 178–197)
- Modify: `src/features/adventure/__tests__/store.test.ts` (если завязан на 10 — обновить)

- [ ] **Step 4.1: Конфиг**

В `src/features/adventure/logic/config.ts`: `dailyGoalLevels: 5,` (было 10; спека §1 — планка казуала).

- [ ] **Step 4.2: Победа уровня — стрик + клеймы**

В `src/app/adventure-level.tsx`, ветка `runStatus === 'won'`, после `useAdventure.getState().recordWin(todayISO());` добавить (импорты: `useDailyBonus` из `@/features/dailybonus`, `ADVENTURE_CONFIG` из `@/features/adventure`, `useStreak` уже не импортирован — добавить `useStreak` к существующему импорту `todayISO` из `@/features/streak`):

```ts
      // Победа в Adventure поддерживает стрик и дейли-цикл наравне с классикой.
      useStreak.getState().markPlayedToday();
      useDailyBonus.getState().claimFirstWin();
      const clearedToday = useAdventure.getState().dailyCleared(todayISO());
      if (clearedToday === ADVENTURE_CONFIG.dailyGoalLevels) {
        useAnalyticsStore.getState().track('adventure_daily_goal_done', { cleared: clearedToday });
      }
      if (clearedToday >= ADVENTURE_CONFIG.dailyGoalLevels) {
        useDailyBonus.getState().claimDailyGoal(); // идемпотентен в пределах дня
      }
```

Разместить ДО `setTimeout(... setPhase('levelup'))`, чтобы `pendingCelebration` был готов к моменту показа LevelResultView.

- [ ] **Step 4.3: Проверить тесты adventure**

Run: `npx jest src/features/adventure`
Expected: PASS (если тесты стора зашиты на «10» — поправить на `ADVENTURE_CONFIG.dailyGoalLevels`).

### Task 5: DailyBonusMoment — celebration на экранах результата

**Files:**
- Create: `src/features/dailybonus/components/DailyBonusMoment.tsx`
- Modify: `src/core/i18n/en.ts`, `src/core/i18n/ru.ts` (секция `daily`)
- Modify: `src/features/game/components/GameOverOverlay.tsx`
- Modify: `src/features/adventure/components/LevelResultView.tsx`
- Modify: `src/features/dailybonus/index.ts` (экспорт `DailyBonusMoment`, см. Task 2.5)

- [ ] **Step 5.1: i18n — новая секция daily**

В `src/core/i18n/en.ts` заменить секцию `daily` на:

```ts
  daily: {
    title: 'Daily bonus',
    day: 'Day',
    protected: 'streak protected',
    dropItem: 'New item!',
    dropCharge: 'Helper charge!',
    momentTitle: 'Daily bonus!',
    momentGoal: 'Daily Goal complete!',
    playForBonus: 'Win a game',
    collected: 'collected',
    goalProgress: 'Adventure Daily Goal',
    goalDone: 'Goal reward collected',
    today: 'Today',
  },
```

В `src/core/i18n/ru.ts` — ту же структуру:

```ts
  daily: {
    title: 'Дневной бонус',
    day: 'День',
    protected: 'цепочку прикрыли',
    dropItem: 'Новый предмет!',
    dropCharge: 'Заряд помощника!',
    momentTitle: 'Дневной бонус!',
    momentGoal: 'Цель дня выполнена!',
    playForBonus: 'Выиграй партию',
    collected: 'забрано',
    goalProgress: 'Цель дня в Приключении',
    goalDone: 'Награда за цель получена',
    today: 'Сегодня',
  },
```

Ключи `claim`, `comeBack`, `tomorrow` удаляются (кнопки клейма больше нет) — tsc покажет оставшихся потребителей, они чинятся в Task 6. Заодно обновить онбординг-копию: в en `onboarding.dailyBody: 'Win a game every day — bonus points grow with your streak.'`, в ru `onboarding.dailyBody: 'Выигрывай каждый день — бонус-очки растут вместе со стриком.'`.

- [ ] **Step 5.2: Компонент DailyBonusMoment**

Создать `src/features/dailybonus/components/DailyBonusMoment.tsx`:

```tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, FireIcon, colors, radii, spacing } from '@/ui';

import { useDailyBonus } from '../store';

/**
 * Celebration-блок дейли-бонуса на экранах результата (game over / победа уровня).
 * Показывает pendingCelebration из стора и гасит его при размонтировании.
 * Тон (dark/light) — под фон хоста: game over — тёмный оверлей, Adventure — тёмный градиент.
 */
export function DailyBonusMoment() {
  const celebration = useDailyBonus((s) => s.pendingCelebration);

  useEffect(() => () => useDailyBonus.getState().ackCelebration(), []);

  const lang = useLang();
  if (!celebration) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(14)}
      exiting={FadeOut.duration(160)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: spacing.s,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s,
        borderRadius: radii.button,
        backgroundColor: colors.cardSolid,
        borderWidth: 1,
        borderColor: colors.accent,
      }}
    >
      {celebration.kind === 'firstWin' ? (
        <>
          <FireIcon size={18} />
          <View>
            <AppText preset="button" style={{ color: colors.accent }}>
              {t('daily.momentTitle', lang)} +{celebration.points} ×{celebration.multiplier}
            </AppText>
            <AppText preset="caption">
              {t('daily.day', lang)} {celebration.day}
            </AppText>
          </View>
        </>
      ) : (
        <View>
          <AppText preset="button" style={{ color: colors.accent }}>
            🎁 {t('daily.momentGoal', lang)}
          </AppText>
          <AppText preset="caption">
            {celebration.drop.type === 'helperCharge'
              ? t('daily.dropCharge', lang)
              : t('daily.dropItem', lang)}
          </AppText>
        </View>
      )}
    </Animated.View>
  );
}
```

Проверить, что `FireIcon` экспортируется из `@/ui` (используется в `src/app/index.tsx`); если пресет цветов в этом контексте выглядит бледно на тёмном фоне Adventure — допустимо передать проп `tone?: 'card' | 'dark'`, но не усложнять без нужды.

- [ ] **Step 5.3: Встроить в GameOverOverlay**

В `src/features/game/components/GameOverOverlay.tsx` добавить импорт `import { DailyBonusMoment } from '@/features/dailybonus';` и вставить строку после заголовка (`<AppText preset="title" ...>{...}</AppText>`):

```tsx
      <DailyBonusMoment />
```

- [ ] **Step 5.4: Встроить в LevelResultView + i18n чипа цели**

В `src/features/adventure/components/LevelResultView.tsx`:
1. Импорт `import { DailyBonusMoment } from '@/features/dailybonus';` (цикла нет: dailybonus не импортирует adventure).
2. Чип цели дня — заменить захардкоженные строки на i18n (`useLang` уже есть):

```tsx
          <AppText preset="button" style={{ color: '#FFFFFF' }}>
            {dailyDone ? t('home.dailyGoalDone', lang) : `${t('home.dailyGoal', lang)}:`}{' '}
            {Math.min(dailyCleared, ADVENTURE_CONFIG.dailyGoalLevels)}/{ADVENTURE_CONFIG.dailyGoalLevels}
          </AppText>
```

3. Сразу после `Animated.View` чипа цели добавить `<DailyBonusMoment />`.

- [ ] **Step 5.5: Компонент-тест момента**

Создать тест по паттерну существующих компонент-тестов (`src/features/game/__tests__/recordCelebration.test.tsx` — образец рендера с зустанд-сторами) в `src/features/dailybonus/__tests__/dailyBonusMoment.test.tsx`:

```tsx
import { act, create } from 'react-test-renderer';

import { DailyBonusMoment } from '../components/DailyBonusMoment';
import { useDailyBonus } from '../store';

it('показывает firstWin-момент и гасит его при размонтировании', () => {
  useDailyBonus.setState({
    pendingCelebration: { kind: 'firstWin', points: 625, multiplier: 1.25, day: 2 },
  });
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<DailyBonusMoment />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('625');
  act(() => tree.unmount());
  expect(useDailyBonus.getState().pendingCelebration).toBeNull();
});

it('ничего не рендерит без pendingCelebration', () => {
  useDailyBonus.setState({ pendingCelebration: null });
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<DailyBonusMoment />);
  });
  expect(tree.toJSON()).toBeNull();
});
```

(Синтаксис импортов/моков подогнать под соседние `.test.tsx` — у них общий jest-setup с моками Reanimated.)

Run: `npx jest src/features/dailybonus`
Expected: PASS.

### Task 6: DailyCard-статус + Home + AdventureEntryCard

**Files:**
- Modify: `src/features/dailybonus/components/DailyCard.tsx` (полная переработка)
- Modify: `src/app/index.tsx` (передача пропсов, тап-навигация)
- Modify: `src/features/adventure/components/AdventureEntryCard.tsx` (строка «Сегодня: N/5»)
- Modify: `src/app/__tests__/homeDailyMap.test.ts` (обновить под новый DailyCard)

- [ ] **Step 6.1: Переписать DailyCard в статус дня**

Заменить содержимое `src/features/dailybonus/components/DailyCard.tsx`. Ключевое: без кнопки клейма и без DailyReveal; прогресс цели приходит пропсами (не импортировать adventure — цикл!); тап по карточке отдаёт наружу `onGoalPress` (Home решает, куда вести).

```tsx
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/core/i18n';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { isStreakAlive, todayISO, useStreak } from '@/features/streak';
import { AppText, FireIcon, colors, radii, spacing } from '@/ui';

import { dailyPreview } from '../logic/reward';
import { useDailyBonus } from '../store';

const LADDER = [1, 2, 3, 4, 5, 6, 7];

export interface DailyGoalProgress {
  cleared: number;
  target: number;
}

/**
 * Статус дневного цикла на Home (спека retention-rework §1): лесенка стрика +
 * две ступени — «выиграй партию → +N ×M» (ступень 1, начисляется сама за игру)
 * и «цель дня в Приключении N/T → 🎁» (ступень 2). Кнопки клейма нет: бонус
 * выдаётся за игру, карточка только показывает состояние и ведёт в Adventure.
 * Не показывается до первой партии (анти-чеклист 06).
 */
export function DailyCard({
  goal,
  onGoalPress,
}: {
  goal: DailyGoalProgress | null;
  onGoalPress?: () => void;
}) {
  const lang = useLang();
  const gamesPlayed = useScores((s) => s.gamesPlayed);
  const streakCount = useStreak((s) => s.count);
  const streakLastDay = useStreak((s) => s.lastDay);
  const protectorDay = useStreak((s) => s.protectorLastUsedDay);
  const lastClaimDay = useDailyBonus((s) => s.lastClaimDay);
  const lastGoalClaimDay = useDailyBonus((s) => s.lastGoalClaimDay);

  const today = todayISO();
  const liveStreak = isStreakAlive({ lastDay: streakLastDay, count: streakCount }, today)
    ? streakCount
    : 0;
  const preview = dailyPreview(Math.max(liveStreak, 1));
  const firstWinDone = lastClaimDay === today;
  const goalDone = lastGoalClaimDay === today;
  const protectedToday = protectorDay === today;

  if (gamesPlayed < 1) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText preset="body">{t('daily.title', lang)}</AppText>
        <AppText preset="caption" style={{ color: colors.accent }}>
          {t('daily.day', lang)} {preview.day} · ×{preview.multiplier}
        </AppText>
      </View>

      <View style={styles.ladder}>
        {LADDER.map((d) => (
          <View
            key={d}
            style={[
              styles.rung,
              { backgroundColor: d <= preview.day ? colors.accent : colors.surface },
            ]}
          />
        ))}
      </View>

      {protectedToday ? (
        <AppText preset="caption">🛟 {t('daily.protected', lang)}</AppText>
      ) : null}

      <View style={styles.stageRow}>
        <FireIcon size={14} />
        {firstWinDone ? (
          <AppText preset="caption" style={{ color: colors.accent }}>
            ✓ +{preview.points} {t('daily.collected', lang)}
          </AppText>
        ) : (
          <AppText preset="caption">
            {t('daily.playForBonus', lang)} → +{preview.points}
          </AppText>
        )}
      </View>

      {goal ? (
        <Pressable
          onPress={goalDone ? undefined : onGoalPress}
          accessibilityRole="button"
          accessibilityLabel={t('daily.goalProgress', lang)}
          style={styles.stageRow}
        >
          {goalDone ? (
            <AppText preset="caption" style={{ color: colors.accent }}>
              ✓ 🎁 {t('daily.goalDone', lang)}
            </AppText>
          ) : (
            <AppText preset="caption">
              🎁 {t('daily.goalProgress', lang)}: {Math.min(goal.cleared, goal.target)}/{goal.target}
            </AppText>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    gap: spacing.xs,
    padding: spacing.m,
    borderRadius: radii.card,
    backgroundColor: colors.cardSolid,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ladder: {
    flexDirection: 'row',
    gap: 4,
  },
  rung: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
```

Экспортировать тип: в `src/features/dailybonus/index.ts` добавить `export type { DailyGoalProgress } from './components/DailyCard';`.

- [ ] **Step 6.2: Home — передать прогресс цели**

В `src/app/index.tsx`:
1. Импорты: `import { ADVENTURE_CONFIG, AdventureEntryCard } from '@/features/adventure';` (AdventureEntryCard уже импортирован — расширить), `import { useAdventure } from '@/features/adventure';`.
2. В `HomeScreen` добавить:

```tsx
  const adventureDaily = useAdventure((s) => s.daily);
  const todayIso = todayISO();
  const dailyGoal = {
    cleared: adventureDaily.date === todayIso ? adventureDaily.cleared : 0,
    target: ADVENTURE_CONFIG.dailyGoalLevels,
  };
```

(подписка на `s.daily` вместо вызова `dailyCleared()` — чтобы карточка обновлялась при изменении.)
3. Заменить `<DailyCard />` на:

```tsx
          <DailyCard goal={dailyGoal} onGoalPress={() => router.push('/adventure' as Href)} />
```

(`Href` уже используется в проекте — импорт из `expo-router`; если в index.tsx пуш по строке работает без каста — писать как соседние `router.push('/settings')`.)

- [ ] **Step 6.3: AdventureEntryCard — «Сегодня: N/5»**

В `src/features/adventure/components/AdventureEntryCard.tsx` добавить под строкой `Уровень {levelIndex + 1}/{len}` блок цели дня (импорты: `todayISO` из `@/features/streak`, `ADVENTURE_CONFIG` из `../logic/config`, `t`/`useLang` — из `@/core/i18n` и `@/features/settings`):

```tsx
              <DailyGoalRow />
```

и в том же файле компонент:

```tsx
/** Мини-прогресс цели дня: «Сегодня: 3/5» + 🎁 на конце; выполненная — галочка. */
function DailyGoalRow() {
  const lang = useLang();
  const daily = useAdventure((s) => s.daily);
  const today = todayISO();
  const target = ADVENTURE_CONFIG.dailyGoalLevels;
  const cleared = Math.min(daily.date === today ? daily.cleared : 0, target);
  const done = cleared >= target;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          flex: 1,
          maxWidth: 120,
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(255,255,255,0.22)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${(cleared / target) * 100}%`,
            height: 6,
            backgroundColor: done ? '#7DF29B' : '#FFD338',
          }}
        />
      </View>
      <AppText preset="caption" style={{ color: '#DCE6FF' }}>
        {done ? `✓ ${t('home.dailyGoalDone', lang)}` : `${t('daily.today', lang)}: ${cleared}/${target} 🎁`}
      </AppText>
    </View>
  );
}
```

Цвета здесь — фирменные цвета Adventure-карточки (жёлтый `#FFD338` из логотипа, зелёный done), это осознанное исключение как и остальная карточка-градиент.

- [ ] **Step 6.4: Обновить homeDailyMap-тест**

`src/app/__tests__/homeDailyMap.test.ts`: заменить ожидания старого DailyCard (кнопка «Забрать») на новые статусы — например, при `gamesPlayed >= 1` и незабранной ступени 1 рендер содержит `playForBonus`-текст и `«🎁»`-строку цели `0/5`; после `claimFirstWin()` — `✓`. Точный синтаксис — по текущему содержимому файла (он уже рендерит Home с моками).

- [ ] **Step 6.5: Полный прогон и коммит фазы UI**

Run: `npx tsc --noEmit && npx jest`
Expected: всё зелёное (старые потребители `daily.claim`/`computeDaily` к этому моменту устранены).

```bash
git add src/features/dailybonus src/features/game src/features/adventure src/features/analytics/types.ts src/app/index.tsx src/app/adventure-level.tsx src/core/i18n docs/superpowers
git commit -m "feat(daily): дейли-бонус за игру — первая победа дня + цель Adventure с гарантированным дропом"
```

(Коммитить только перечисленные пути — в рабочей копии есть чужие незакоммиченные правки других файлов.)

### Task 7: Спеки

**Files:**
- Modify: `docs/specs/14-daily-bonus.md`
- Modify: `docs/specs/17-adventure-mode.md`
- Modify: `docs/specs/01-screens.md`

- [ ] **Step 7.1: Обновить спеки под новую механику**

- `14-daily-bonus.md`: механика клейма → две ступени (первая победа дня × стрик; цель дня Adventure → гарантированный дроп, day7 — косметика), карточка Home — статус без кнопки, celebration на экранах результата, миграция `lastGoalClaimDay`.
- `17-adventure-mode.md`: дейли-гоал = 5 уровней (обоснование: досягаемость казуалом), награда — ступень 2 дейли-бонуса; победа уровня поддерживает стрик.
- `01-screens.md`: Home — DailyCard-статус и строка цели на AdventureEntryCard; Game Over — DailyBonusMoment.

Формулировки — краткие правки существующих разделов, не переписывание файлов целиком.

- [ ] **Step 7.2: Коммит**

```bash
git add docs/specs/14-daily-bonus.md docs/specs/17-adventure-mode.md docs/specs/01-screens.md
git commit -m "docs(specs): дейли-цикл за игру — обновление 14/17/01 под retention фазу 1"
```

---

## Self-review (выполнен при написании)

- Покрытие спеки §1: ступень 1 классика (Task 3) и Adventure (Task 4), ступень 2 (Task 4), гарантированный дроп + day7 (Task 1), удаление dropChanceByStreak (Task 1), DailyCard-статус (Task 6), AdventureEntryCard (Task 6), celebration-моменты (Task 5), миграция lastClaimDay (Task 2), аналитика (Task 2/4), i18n (Task 5), цель 10→5 (Task 4), стрик за Adventure (Task 4), спеки (Task 7). Пробелов нет.
- Циклы импортов: dailybonus не импортирует adventure (goal — пропсами), game→dailybonus и adventure→dailybonus односторонние.
- Типы сквозные: `DailyCelebration`, `DailyDropItem`, `DailyGoalProgress`, `computeFirstWin`/`computeGoalDrop` согласованы между задачами.
- Известная неточность: тесты в Task 3/6.4 описаны сценарно (точный каркас зависит от текущего содержимого тестовых файлов) — исполнитель обязан переиспользовать существующие хелперы этих файлов, а не изобретать моки.
