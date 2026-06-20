# Progression core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-logic + store foundation of the unified game progression (Уровень Игры from cumulative points → level → world → reward), with safe migration from the old mascot XP.

**Architecture:** New module `features/progression`. Pure, React/RN-free logic in `logic/` (config, levels, worlds, rewards) covered by Jest; a zustand+MMKV store exposing `addPoints` and selectors. No UI in this plan. The game/mascot wiring coordinator is intentionally deferred to the daily-bonus / mascot-decoupling plans so this subsystem is independently testable.

**Tech Stack:** TypeScript (strict), zustand, react-native-mmkv (via `@/core/storage`), Jest.

**Source spec:** [docs/specs/11-progression-core.md](../specs/11-progression-core.md) (parent [10-progression.md](../specs/10-progression.md)).

---

## File structure

- Create `src/features/progression/logic/types.ts` — shared types (`Stage`, `HelperId`, reward types, `ProgressInfo`).
- Create `src/features/progression/logic/config.ts` — `PROGRESSION_CONFIG` (data, tuned without code).
- Create `src/features/progression/logic/worlds.ts` — world boundaries from `tierGaps`.
- Create `src/features/progression/logic/levels.ts` — points↔level curve.
- Create `src/features/progression/logic/rewards.ts` — reward + stage per level.
- Create `src/features/progression/store.ts` — zustand store + MMKV persist + migration.
- Create `src/features/progression/index.ts` — public API (rule 02).
- Modify `src/core/storage/index.ts` — add `KEYS.progression`.
- Tests: `src/features/progression/__tests__/{config,worlds,levels,rewards,store}.test.ts`.

Dependency direction: `progression → core` only (rule 02). `logic/` imports nothing from React/RN.

---

## Task 1: Scaffold types, config, storage key

**Files:**
- Create: `src/features/progression/logic/types.ts`
- Create: `src/features/progression/logic/config.ts`
- Modify: `src/core/storage/index.ts:25` (add key after `mascot`)
- Test: `src/features/progression/__tests__/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/progression/__tests__/config.test.ts
import { PROGRESSION_CONFIG } from '../logic/config';

describe('PROGRESSION_CONFIG', () => {
  it('кривая стоимости валидна', () => {
    expect(PROGRESSION_CONFIG.levelCost.base).toBeGreaterThan(0);
    expect(PROGRESSION_CONFIG.levelCost.growth).toBeGreaterThan(1);
  });

  it('tierGaps непустой и положительный', () => {
    expect(PROGRESSION_CONFIG.tierGaps.length).toBeGreaterThan(0);
    for (const gap of PROGRESSION_CONFIG.tierGaps) expect(gap).toBeGreaterThan(0);
  });

  it('у первого мира есть тема', () => {
    expect(PROGRESSION_CONFIG.worldThemeId[1]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/progression/__tests__/config.test.ts`
Expected: FAIL — cannot find module `../logic/config`.

- [ ] **Step 3: Create the types file**

```ts
// src/features/progression/logic/types.ts
export type Stage = 1 | 2 | 3 | 4;
export type HelperId = 'hint' | 'swap';

export interface RewardCosmetic { kind: 'cosmetic'; id: string }
export interface RewardHelper { kind: 'helper'; id: HelperId }
export interface RewardWorld { kind: 'world'; world: number; themeId: string; evolveStage?: Stage }
export type LevelReward = RewardCosmetic | RewardHelper | RewardWorld;

export interface ProgressInfo {
  level: number;
  world: number;
  pointsInLevel: number;
  pointsToNext: number;
}
```

- [ ] **Step 4: Create the config file**

```ts
// src/features/progression/logic/config.ts
import type { HelperId, Stage } from './types';

export interface ProgressionConfig {
  levelCost: { base: number; growth: number };
  tierGaps: number[];
  maxAuthoredLevel: number;
  evolutionAtWorld: Partial<Record<number, Stage>>;
  worldThemeId: Partial<Record<number, string>>;
  levelRewards: Partial<Record<number, { kind: 'cosmetic'; id: string } | { kind: 'helper'; id: HelperId }>>;
}

export const PROGRESSION_CONFIG: ProgressionConfig = {
  levelCost: { base: 1000, growth: 1.16 },
  tierGaps: [5, 7, 9, 11, 14, 18, 22],
  maxAuthoredLevel: 64,
  evolutionAtWorld: { 1: 1, 2: 2, 4: 3, 6: 4 },
  worldThemeId: { 1: 'classic', 2: 'neon', 3: 'sunset', 4: 'mono', 5: 'aqua', 6: 'galaxy', 7: 'gold' },
  levelRewards: {
    1: { kind: 'cosmetic', id: 'hat-casquette' },
    3: { kind: 'cosmetic', id: 'face-glasses' },
    4: { kind: 'cosmetic', id: 'acc-headphones' },
    5: { kind: 'helper', id: 'hint' },
    8: { kind: 'cosmetic', id: 'skin-mint' },
    9: { kind: 'helper', id: 'swap' },
    10: { kind: 'cosmetic', id: 'hat-panama' },
    12: { kind: 'cosmetic', id: 'face-sunglasses' },
    14: { kind: 'cosmetic', id: 'acc-scarf' },
    16: { kind: 'cosmetic', id: 'skin-coral' },
    17: { kind: 'cosmetic', id: 'hat-beanie' },
    19: { kind: 'cosmetic', id: 'face-star-eyes' },
    20: { kind: 'cosmetic', id: 'acc-backpack' },
  },
};
```

- [ ] **Step 5: Add the storage key**

In `src/core/storage/index.ts`, add a line inside the `KEYS` object right after `mascot: 'mascot.state',`:

```ts
  mascot: 'mascot.state',
  progression: 'progression.state',
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/features/progression/__tests__/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/features/progression/logic/types.ts src/features/progression/logic/config.ts src/features/progression/__tests__/config.test.ts src/core/storage/index.ts
git commit -m "feat(progression): scaffold types, config and storage key"
```

---

## Task 2: World boundaries (`worlds.ts`)

**Files:**
- Create: `src/features/progression/logic/worlds.ts`
- Test: `src/features/progression/__tests__/worlds.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/progression/__tests__/worlds.test.ts
import { worldStartLevels, worldForLevel, isWorldStart, nextWorldLevel } from '../logic/worlds';

describe('worldStartLevels', () => {
  it('из tierGaps [5,7,9,11,14,18,22] → [1,6,13,22,33,47,65,87]', () => {
    expect(worldStartLevels()).toEqual([1, 6, 13, 22, 33, 47, 65, 87]);
  });
});

describe('worldForLevel', () => {
  it('границы миров', () => {
    expect(worldForLevel(1)).toBe(1);
    expect(worldForLevel(5)).toBe(1);
    expect(worldForLevel(6)).toBe(2);
    expect(worldForLevel(12)).toBe(2);
    expect(worldForLevel(13)).toBe(3);
    expect(worldForLevel(22)).toBe(4);
  });
  it('ниже 1 → мир 1', () => {
    expect(worldForLevel(0)).toBe(1);
  });
});

describe('isWorldStart', () => {
  it('true на старте мира, false внутри', () => {
    expect(isWorldStart(6)).toBe(true);
    expect(isWorldStart(13)).toBe(true);
    expect(isWorldStart(7)).toBe(false);
  });
});

describe('nextWorldLevel', () => {
  it('следующий мировой уровень', () => {
    expect(nextWorldLevel(1)).toBe(6);
    expect(nextWorldLevel(6)).toBe(13);
    expect(nextWorldLevel(12)).toBe(13);
  });
  it('за последним миром → null', () => {
    expect(nextWorldLevel(999)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/progression/__tests__/worlds.test.ts`
Expected: FAIL — cannot find module `../logic/worlds`.

- [ ] **Step 3: Implement `worlds.ts`**

```ts
// src/features/progression/logic/worlds.ts
import { PROGRESSION_CONFIG, type ProgressionConfig } from './config';

export function worldStartLevels(cfg: ProgressionConfig = PROGRESSION_CONFIG): number[] {
  const starts = [1];
  let level = 1;
  for (const gap of cfg.tierGaps) {
    level += gap;
    starts.push(level);
  }
  return starts;
}

export function worldForLevel(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  const L = Math.max(1, Math.floor(level));
  const starts = worldStartLevels(cfg);
  let world = 1;
  for (let i = 0; i < starts.length; i++) {
    if (L >= starts[i]) world = i + 1;
    else break;
  }
  return world;
}

export function isWorldStart(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): boolean {
  return worldStartLevels(cfg).includes(Math.floor(level));
}

export function nextWorldLevel(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number | null {
  const L = Math.floor(level);
  for (const s of worldStartLevels(cfg)) {
    if (s > L) return s;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/progression/__tests__/worlds.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/progression/logic/worlds.ts src/features/progression/__tests__/worlds.test.ts
git commit -m "feat(progression): world boundaries from tier gaps"
```

---

## Task 3: Points↔level curve (`levels.ts`)

**Files:**
- Create: `src/features/progression/logic/levels.ts`
- Test: `src/features/progression/__tests__/levels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/progression/__tests__/levels.test.ts
import { levelCost, thresholdForLevel, levelForPoints, progressFor } from '../logic/levels';

describe('levelCost', () => {
  it('cost(1) = base = 1000', () => {
    expect(levelCost(1)).toBe(1000);
  });
  it('строго возрастает', () => {
    for (let L = 1; L < 40; L++) {
      expect(levelCost(L + 1)).toBeGreaterThan(levelCost(L));
    }
  });
});

describe('thresholdForLevel', () => {
  it('reach уровня 1 = 0 очков', () => {
    expect(thresholdForLevel(1)).toBe(0);
  });
  it('reach уровня 2 = cost(1)', () => {
    expect(thresholdForLevel(2)).toBe(levelCost(1));
  });
  it('reach уровня 3 = cost(1)+cost(2)', () => {
    expect(thresholdForLevel(3)).toBe(levelCost(1) + levelCost(2));
  });
});

describe('levelForPoints', () => {
  it('инверсия порога точна на границах L=1..50', () => {
    for (let L = 1; L <= 50; L++) {
      expect(levelForPoints(thresholdForLevel(L))).toBe(L);
    }
  });
  it('на 1 очко ниже порога — предыдущий уровень', () => {
    expect(levelForPoints(thresholdForLevel(5) - 1)).toBe(4);
  });
  it('отрицательные очки → уровень 1', () => {
    expect(levelForPoints(-100)).toBe(1);
  });
});

describe('progressFor', () => {
  it('0 очков → уровень 1, мир 1, в уровне 0, до следующего = cost(1)', () => {
    expect(progressFor(0)).toEqual({ level: 1, world: 1, pointsInLevel: 0, pointsToNext: 1000 });
  });
  it('ровно на пороге уровня 2', () => {
    expect(progressFor(thresholdForLevel(2))).toEqual({
      level: 2,
      world: 1,
      pointsInLevel: 0,
      pointsToNext: levelCost(2),
    });
  });
  it('середина уровня 3', () => {
    const p = thresholdForLevel(3) + 5;
    expect(progressFor(p)).toEqual({
      level: 3,
      world: 1,
      pointsInLevel: 5,
      pointsToNext: levelCost(3) - 5,
    });
  });
  it('уровень 6 уже в мире 2', () => {
    expect(progressFor(thresholdForLevel(6)).world).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/progression/__tests__/levels.test.ts`
Expected: FAIL — cannot find module `../logic/levels`.

- [ ] **Step 3: Implement `levels.ts`**

```ts
// src/features/progression/logic/levels.ts
import { PROGRESSION_CONFIG, type ProgressionConfig } from './config';
import { worldForLevel } from './worlds';
import type { ProgressInfo } from './types';

export function levelCost(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  const L = Math.max(1, Math.floor(level));
  return Math.round(cfg.levelCost.base * Math.pow(cfg.levelCost.growth, L - 1));
}

export function thresholdForLevel(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  const L = Math.max(1, Math.floor(level));
  let sum = 0;
  for (let i = 1; i < L; i++) sum += levelCost(i, cfg);
  return sum;
}

export function levelForPoints(points: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  let level = 1;
  let remaining = Math.max(0, points);
  while (remaining >= levelCost(level, cfg)) {
    remaining -= levelCost(level, cfg);
    level += 1;
  }
  return level;
}

export function progressFor(points: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): ProgressInfo {
  let level = 1;
  let remaining = Math.max(0, points);
  while (remaining >= levelCost(level, cfg)) {
    remaining -= levelCost(level, cfg);
    level += 1;
  }
  return {
    level,
    world: worldForLevel(level, cfg),
    pointsInLevel: remaining,
    pointsToNext: levelCost(level, cfg) - remaining,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/progression/__tests__/levels.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/progression/logic/levels.ts src/features/progression/__tests__/levels.test.ts
git commit -m "feat(progression): points-to-level curve"
```

---

## Task 4: Rewards and stage (`rewards.ts`)

**Files:**
- Create: `src/features/progression/logic/rewards.ts`
- Test: `src/features/progression/__tests__/rewards.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/progression/__tests__/rewards.test.ts
import { rewardForLevel, rewardsBetween, stageForLevel } from '../logic/rewards';

describe('rewardForLevel', () => {
  it('старт мира 2 (ур.6) → world + тема neon + эволюция в стадию 2', () => {
    expect(rewardForLevel(6)).toEqual({ kind: 'world', world: 2, themeId: 'neon', evolveStage: 2 });
  });
  it('старт мира 3 (ур.13) → world без эволюции', () => {
    expect(rewardForLevel(13)).toEqual({ kind: 'world', world: 3, themeId: 'sunset' });
  });
  it('ур.5 → помощник hint', () => {
    expect(rewardForLevel(5)).toEqual({ kind: 'helper', id: 'hint' });
  });
  it('ур.1 → косметика (не world, мир 1 — стартовый)', () => {
    expect(rewardForLevel(1)).toEqual({ kind: 'cosmetic', id: 'hat-casquette' });
  });
  it('пустой уровень (ур.2) → null', () => {
    expect(rewardForLevel(2)).toBeNull();
  });
});

describe('rewardsBetween', () => {
  it('дайджест ур.4→6 включает помощника(5) и мир(6), пропускает пустые', () => {
    expect(rewardsBetween(4, 6)).toEqual([
      { kind: 'helper', id: 'hint' },
      { kind: 'world', world: 2, themeId: 'neon', evolveStage: 2 },
    ]);
  });
  it('пустой диапазон → []', () => {
    expect(rewardsBetween(6, 6)).toEqual([]);
  });
});

describe('stageForLevel', () => {
  it('эволюция по мирам', () => {
    expect(stageForLevel(1)).toBe(1);
    expect(stageForLevel(6)).toBe(2);
    expect(stageForLevel(13)).toBe(2);
    expect(stageForLevel(22)).toBe(3);
    expect(stageForLevel(47)).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/progression/__tests__/rewards.test.ts`
Expected: FAIL — cannot find module `../logic/rewards`.

- [ ] **Step 3: Implement `rewards.ts`**

```ts
// src/features/progression/logic/rewards.ts
import { PROGRESSION_CONFIG, type ProgressionConfig } from './config';
import { worldForLevel, isWorldStart } from './worlds';
import type { LevelReward, Stage } from './types';

export function stageForLevel(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): Stage {
  const world = worldForLevel(level, cfg);
  let stage: Stage = 1;
  for (let w = 1; w <= world; w++) {
    const s = cfg.evolutionAtWorld[w];
    if (s !== undefined) stage = s;
  }
  return stage;
}

export function rewardForLevel(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): LevelReward | null {
  const L = Math.floor(level);
  if (L < 1) return null;
  if (L > 1 && isWorldStart(L, cfg)) {
    const world = worldForLevel(L, cfg);
    const themeId = cfg.worldThemeId[world];
    if (themeId !== undefined) {
      const evolveStage = cfg.evolutionAtWorld[world];
      return evolveStage !== undefined
        ? { kind: 'world', world, themeId, evolveStage }
        : { kind: 'world', world, themeId };
    }
  }
  return cfg.levelRewards[L] ?? null;
}

export function rewardsBetween(
  fromLevelExcl: number,
  toLevelIncl: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): LevelReward[] {
  const out: LevelReward[] = [];
  for (let L = Math.floor(fromLevelExcl) + 1; L <= Math.floor(toLevelIncl); L++) {
    const r = rewardForLevel(L, cfg);
    if (r !== null) out.push(r);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/progression/__tests__/rewards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/progression/logic/rewards.ts src/features/progression/__tests__/rewards.test.ts
git commit -m "feat(progression): per-level rewards and capi stage"
```

---

## Task 5: Store (`store.ts`) with migration

**Files:**
- Create: `src/features/progression/store.ts`
- Test: `src/features/progression/__tests__/store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/progression/__tests__/store.test.ts
import { useProgression } from '../store';
import { thresholdForLevel } from '../logic/levels';

function reset() {
  useProgression.setState({
    lifetimePoints: 0,
    level: 1,
    world: 1,
    unlockedThemes: ['classic'],
    activeTheme: 'classic',
    claimedRewards: [],
  });
}

describe('useProgression.addPoints', () => {
  beforeEach(reset);

  it('накопление поднимает уровень и отдаёт награды диапазона', () => {
    const res = useProgression.getState().addPoints(thresholdForLevel(6));
    expect(res.fromLevel).toBe(1);
    expect(res.toLevel).toBe(6);
    expect(res.enteredWorld).toBe(2);
    expect(res.rewards).toContainEqual({ kind: 'world', world: 2, themeId: 'neon', evolveStage: 2 });
    const s = useProgression.getState();
    expect(s.world).toBe(2);
    expect(s.unlockedThemes).toEqual(['classic', 'neon']);
    expect(s.activeTheme).toBe('neon');
    expect(s.claimedRewards).toContain('hat-casquette');
  });

  it('без смены уровня enteredWorld = null, rewards пуст', () => {
    const res = useProgression.getState().addPoints(10);
    expect(res.fromLevel).toBe(1);
    expect(res.toLevel).toBe(1);
    expect(res.enteredWorld).toBeNull();
    expect(res.rewards).toEqual([]);
  });

  it('отрицательное прибавление клампится к 0', () => {
    useProgression.getState().addPoints(-50);
    expect(useProgression.getState().lifetimePoints).toBe(0);
  });
});

describe('useProgression.setActiveTheme', () => {
  beforeEach(reset);

  it('переключает только на открытую тему', () => {
    useProgression.setState({ unlockedThemes: ['classic', 'neon'] });
    useProgression.getState().setActiveTheme('neon');
    expect(useProgression.getState().activeTheme).toBe('neon');
    useProgression.getState().setActiveTheme('galaxy');
    expect(useProgression.getState().activeTheme).toBe('neon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/progression/__tests__/store.test.ts`
Expected: FAIL — cannot find module `../store`.

- [ ] **Step 3: Implement `store.ts`**

```ts
// src/features/progression/store.ts
import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

import { PROGRESSION_CONFIG } from './logic/config';
import { progressFor } from './logic/levels';
import { worldStartLevels } from './logic/worlds';
import { rewardsBetween } from './logic/rewards';
import type { LevelReward } from './logic/types';

export interface ProgressionState {
  lifetimePoints: number;
  level: number;
  world: number;
  unlockedThemes: string[];
  activeTheme: string;
  claimedRewards: string[];
}

export interface AddPointsResult {
  fromLevel: number;
  toLevel: number;
  rewards: LevelReward[];
  enteredWorld: number | null;
}

interface ProgressionActions {
  addPoints: (amount: number) => AddPointsResult;
  setActiveTheme: (id: string) => void;
  pointsInLevel: () => number;
  pointsToNext: () => number;
  nextWorldAt: () => number | null;
}

type ProgressionStore = ProgressionState & ProgressionActions;

function themesThroughWorld(world: number): string[] {
  const ids: string[] = [];
  for (let w = 1; w <= world; w++) {
    const id = PROGRESSION_CONFIG.worldThemeId[w];
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function migratedPoints(saved: Partial<ProgressionState> | null): number {
  if (saved && typeof saved.lifetimePoints === 'number') return saved.lifetimePoints;
  const oldMascot = getJSON<{ totalXp?: number }>(KEYS.mascot);
  return oldMascot && typeof oldMascot.totalXp === 'number' ? oldMascot.totalXp : 0;
}

function buildInitial(): ProgressionState {
  const saved = getJSON<Partial<ProgressionState>>(KEYS.progression);
  const lifetimePoints = Math.max(0, migratedPoints(saved));
  const info = progressFor(lifetimePoints);
  const unlockedThemes = themesThroughWorld(info.world);
  const fallbackTheme = unlockedThemes[unlockedThemes.length - 1] ?? 'classic';
  const defaultTheme = PROGRESSION_CONFIG.worldThemeId[info.world] ?? fallbackTheme;
  const savedActive = saved?.activeTheme;
  const activeTheme = savedActive && unlockedThemes.includes(savedActive) ? savedActive : defaultTheme;
  return {
    lifetimePoints,
    level: info.level,
    world: info.world,
    unlockedThemes,
    activeTheme,
    claimedRewards: saved?.claimedRewards ?? [],
  };
}

function persist(state: ProgressionState): void {
  setJSON(KEYS.progression, {
    lifetimePoints: state.lifetimePoints,
    level: state.level,
    world: state.world,
    unlockedThemes: state.unlockedThemes,
    activeTheme: state.activeTheme,
    claimedRewards: state.claimedRewards,
  });
}

export const useProgression = create<ProgressionStore>((set, get) => ({
  ...buildInitial(),

  addPoints(amount) {
    const prev = get();
    const add = Math.max(0, Math.floor(amount));
    const fromLevel = prev.level;
    const lifetimePoints = prev.lifetimePoints + add;
    const info = progressFor(lifetimePoints);
    const toLevel = info.level;
    const rewards = rewardsBetween(fromLevel, toLevel);
    const unlockedThemes = themesThroughWorld(info.world);
    const enteredWorld = info.world > prev.world ? info.world : null;

    let activeTheme = prev.activeTheme;
    if (enteredWorld !== null) {
      const themeId = PROGRESSION_CONFIG.worldThemeId[enteredWorld];
      if (themeId !== undefined) activeTheme = themeId;
    }

    const claimedRewards = [...prev.claimedRewards];
    for (const r of rewards) {
      if (r.kind === 'cosmetic' && !claimedRewards.includes(r.id)) claimedRewards.push(r.id);
    }

    const next: ProgressionState = {
      lifetimePoints,
      level: toLevel,
      world: info.world,
      unlockedThemes,
      activeTheme,
      claimedRewards,
    };
    set(next);
    persist(next);
    return { fromLevel, toLevel, rewards, enteredWorld };
  },

  setActiveTheme(id) {
    const prev = get();
    if (!prev.unlockedThemes.includes(id)) return;
    const next: ProgressionState = { ...prev, activeTheme: id };
    set({ activeTheme: id });
    persist(next);
  },

  pointsInLevel() {
    return progressFor(get().lifetimePoints).pointsInLevel;
  },
  pointsToNext() {
    return progressFor(get().lifetimePoints).pointsToNext;
  },
  nextWorldAt() {
    const { level } = get();
    for (const s of worldStartLevels()) {
      if (s > level) return s;
    }
    return null;
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/progression/__tests__/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/progression/store.ts src/features/progression/__tests__/store.test.ts
git commit -m "feat(progression): store with addPoints, themes and mascot-xp migration"
```

---

## Task 6: Public API and full verification

**Files:**
- Create: `src/features/progression/index.ts`

- [ ] **Step 1: Create the public API**

```ts
// src/features/progression/index.ts
export { useProgression } from './store';
export type { ProgressionState, AddPointsResult } from './store';
export { PROGRESSION_CONFIG } from './logic/config';
export type { ProgressionConfig } from './logic/config';
export { levelCost, thresholdForLevel, levelForPoints, progressFor } from './logic/levels';
export { worldStartLevels, worldForLevel, isWorldStart, nextWorldLevel } from './logic/worlds';
export { rewardForLevel, rewardsBetween, stageForLevel } from './logic/rewards';
export type {
  Stage,
  HelperId,
  LevelReward,
  RewardCosmetic,
  RewardHelper,
  RewardWorld,
  ProgressInfo,
} from './logic/types';
```

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the 5 new `progression` suites.

- [ ] **Step 4: Commit**

```bash
git add src/features/progression/index.ts
git commit -m "feat(progression): public API barrel"
```

---

## Self-review notes

- **Spec coverage (11):** §2 config → Task 1; §4 levels/worlds/rewards → Tasks 2–4; §5 store (addPoints, setActiveTheme, selectors, init) → Task 5; §7 migration (mascot.totalXp) → Task 5 `migratedPoints`; §8 storage key → Task 1. **Deferred on purpose:** §6 coordinator `useProgressionSync` (needs game `finalResult` + `mascot.unlock`) and `logic/map.ts` (consumed by spec 13) — both land in the daily-bonus / mascot-decoupling / map plans so this subsystem stays UI-free and independently testable. This is called out in the plan header.
- **Placeholder scan:** none — every step has full code/commands.
- **Type consistency:** function names (`levelCost`, `thresholdForLevel`, `levelForPoints`, `progressFor`, `worldStartLevels`, `worldForLevel`, `isWorldStart`, `nextWorldLevel`, `rewardForLevel`, `rewardsBetween`, `stageForLevel`, `useProgression.addPoints`, `setActiveTheme`) match across tasks, the store, and `index.ts`. `worldThemeId` ids (`classic`, `neon`, `sunset`, …) match the theme catalog in spec 12.
- **Note for executor:** cosmetic ids in `levelRewards` reference the existing `features/mascot` catalog (`cosmetics.ts`); they are data strings here (no import). The bridge that actually unlocks them on the mascot is built in the mascot-decoupling plan.
