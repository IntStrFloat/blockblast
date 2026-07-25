# Opening Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first three waves of every new game more likely to offer varied, playable, high-clear opportunities without fixed scripts.

**Architecture:** Store a wave counter in `GameState`. During the opening, sample weighted candidate trays, score bounded placement outcomes on the current board, and randomly select from the highest-scoring candidates. Later waves keep the current generator.

**Tech Stack:** TypeScript, Jest, Mulberry32 RNG.

---

### Task 1: Persist the opening phase

**Files:**
- Modify: `src/core/engine/types.ts`
- Modify: `src/core/engine/game.ts`
- Modify: `src/core/engine/serialize.ts`
- Test: `src/core/engine/__tests__/game.test.ts`
- Test: `src/core/engine/__tests__/serialize.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
expect(createGame(123).waveNumber).toBe(0);
expect(deserialize(serialize(createGame(123)))?.waveNumber).toBe(0);
```

- [ ] **Step 2: Run the focused test to confirm RED**

Run: `npm test -- --runInBand src/core/engine/__tests__/game.test.ts src/core/engine/__tests__/serialize.test.ts`

- [ ] **Step 3: Add `waveNumber: number` to state, initialize it to zero, increment it only when a new tray is dealt, and serialize/validate it.**

- [ ] **Step 4: Re-run the focused tests to confirm GREEN.**

### Task 2: Select non-scripted opening candidates

**Files:**
- Modify: `src/core/engine/game.ts`
- Test: `src/core/engine/__tests__/game.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
for (let seed = 1; seed <= 32; seed += 1) {
  const game = createGame(seed);
  expect(canPlayEntireTray(game.board, game.tray)).toBe(true);
}
expect(distinctOpeningTrays(32)).toBeGreaterThan(8);
```

Add a fixed-seed test that the same seed produces the same opening, and a test that the fourth generated wave preserves the ordinary generation path.

- [ ] **Step 2: Run the focused test to confirm RED.**

Run: `npm test -- --runInBand src/core/engine/__tests__/game.test.ts`

- [ ] **Step 3: Implement `makeOpeningWave` with a fixed candidate budget.**

```ts
const OPENING_WAVES = 3;
// sample weighted trays; reject unplayable ones; score bounded placement search
// by cleared lines, available good placements, density, and repetition; choose
// using RNG from the top quartile.
```

Reuse the existing weighted sampler, placement functions, and PRNG. Do not introduce fixed shape sequences or dependencies.

- [ ] **Step 4: Re-run the focused tests to confirm GREEN.**

### Task 3: Document and verify

**Files:**
- Modify: `docs/specs/03-game-engine.md`

- [ ] **Step 1: Document that opening generation applies to waves 0–2 of every new game, but resume and revive do not reset it.**

- [ ] **Step 2: Run all verification.**

```bash
npm test -- --runInBand src/core/engine/__tests__
npm run typecheck
npm run lint
git diff --check
```

- [ ] **Step 3: Commit with the Lore protocol, recording the executed checks and the rejection of fixed opening scripts.**
