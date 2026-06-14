# Arcade-Balanced Game Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver polished, synchronized placement, clear, combo, score, record, and background effects that remain visually clean and smooth on mobile.

**Architecture:** Keep `PlacementEvent` and the existing deterministic clear presentation as the source of truth. Add focused pure presentation helpers, render board-local effects inside the clipped grid, render falling/overflow effects in an outer layer, and keep active-run record presentation state in the game store. Use Reanimated transform/opacity animations only, deterministic capped particle sets, and explicit visual/performance gates.

**Tech Stack:** Expo SDK 56, React Native 0.85, React 19, React Native Reanimated 4, Zustand, Jest, Expo LinearGradient.

---

## File Structure

- Create `src/features/game/animation/gameFeelPresentation.ts`: pure score-tier, placement-particle, combo-frame, and record-presentation helpers.
- Create `src/features/game/__tests__/gameFeelPresentation.test.ts`: deterministic and boundary tests for the new helpers.
- Create `src/features/game/effects/PlacementParticleLayer.tsx`: capped placement particle/glow rendering.
- Create `src/features/game/effects/BoardFramePulse.tsx`: combo-scaled frame pulse with reduced-motion behavior.
- Create `src/features/game/effects/GameEffectsLayer.tsx`: outer visible-overflow owner for falling fragments/debris and placement effects.
- Create `src/features/game/effects/NewRecordCelebration.tsx`: one-shot in-game record banner and gold confetti.
- Create `src/features/game/components/GameBackground.tsx`: static soft-sunset background and restrained combo pulse.
- Modify `src/features/game/animation/clearPresentation.ts`: add gravity-biased final trajectories and separate local versus overflow clear effects.
- Modify `src/features/game/animation/motion.ts`: centralize animation timing and particle/view budgets.
- Modify `src/features/game/components/BoardView.tsx`: split clipped board from visible-overflow effects.
- Modify `src/features/game/components/Hud.tsx`: animated score tiers, score pulse, and persistent record treatment.
- Modify `src/features/game/effects/ClearLayer.tsx`: render only board-clipped clear effects.
- Modify `src/features/game/effects/BlockCrushLayer.tsx`: support external falling fragments without visual discontinuity.
- Modify `src/features/game/effects/ClearDebrisLayer.tsx`: support external gravity-biased debris.
- Modify `src/features/game/effects/Confetti.tsx`: deterministic palette/count option for the record celebration.
- Modify `src/features/game/effects/useShake.ts`: combine clear severity with combo severity while returning exactly to identity.
- Modify `src/features/game/store.ts`: capture run-start best and emit one active-run record celebration.
- Modify `src/features/game/sound/useGameFeedback.ts`: play the record sound at the in-game record event.
- Modify `src/app/game.tsx`: mount game-only background, outer effects, and record celebration.
- Modify `src/core/i18n/en.ts` and `src/core/i18n/ru.ts`: add in-game record celebration copy if no suitable key exists.
- Modify focused tests under `src/features/game/__tests__/`.

## Quality Budgets

- Common no-clear placement: maximum `12` placement particles.
- Common one-line clear: target at most `64` simultaneously animated effect views outside the 64 board cells.
- Cross/multi-line clear: hard cap `128` simultaneously animated effect views; sample debris before exceeding the cap.
- Record celebration: maximum `18` deterministic gold confetti pieces.
- No React state update per animation frame.
- No animated layout properties (`width`, `height`, `top`, `left`, margins, padding).
- Every external effect container uses `pointerEvents="none"`.
- Every effect timer cleans up on replacement/unmount.
- Rapid accepted placements must replace or coexist without stale overlays, stuck frame glow, or transforms that fail to return to identity.

### Task 1: Lock Pure Presentation Contracts

**Files:**
- Create: `src/features/game/animation/gameFeelPresentation.ts`
- Create: `src/features/game/__tests__/gameFeelPresentation.test.ts`
- Modify: `src/features/game/animation/motion.ts`

- [ ] **Step 1: Read the exact Expo SDK 56 and Reanimated 4 documentation needed for reduced motion, transforms, and entering animations**

Use the versioned Expo documentation at `https://docs.expo.dev/versions/v56.0.0/` and the installed Reanimated 4 API behavior. Record any constraint that changes this plan before implementation.

- [ ] **Step 2: Write failing score-tier, placement-particle, combo-frame, and record presentation tests**

Cover these exact contracts:

```ts
expect(scoreScaleFor(999)).toBe(1);
expect(scoreScaleFor(1000)).toBe(1.1);
expect(scoreScaleFor(5000)).toBe(1.18);
expect(scoreScaleFor(10000)).toBe(1.25);

const first = buildPlacementPresentation(event, GEOM, COLORS, false);
const second = buildPlacementPresentation(event, GEOM, COLORS, false);
expect(second).toEqual(first);
expect(first.particles.length).toBeGreaterThanOrEqual(6);
expect(first.particles.length).toBeLessThanOrEqual(12);

expect(comboFrameFor(event({ combo: 1 }), false).intensity).toBe(0);
expect(comboFrameFor(event({ combo: 3 }), false).intensity).toBeGreaterThan(0);
expect(comboFrameFor(event({ combo: 5 }), false).intensity).toBeLessThanOrEqual(1);
expect(comboFrameFor(event({ combo: 5 }), true).shakeAmplitude).toBe(0);
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npm test -- --runInBand src/features/game/__tests__/gameFeelPresentation.test.ts`

Expected: FAIL because the new presentation helpers do not exist.

- [ ] **Step 4: Implement deterministic capped helpers and central budgets**

Define focused types and pure functions:

```ts
export interface PlacementParticle {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  dx: number;
  dy: number;
  delay: number;
  duration: number;
}

export function scoreScaleFor(score: number): number;
export function buildPlacementPresentation(
  event: PlacementEvent,
  geom: ClearGeometry,
  cellColors: readonly string[],
  reducedMotion: boolean,
): PlacementPresentation;
export function comboFrameFor(
  event: PlacementEvent,
  reducedMotion: boolean,
): ComboFramePresentation;
```

Reuse the deterministic seeded-random pattern from `clearPresentation.ts`; do not use `Math.random()`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- --runInBand src/features/game/__tests__/gameFeelPresentation.test.ts`

Expected: PASS with deterministic output and all budgets enforced.

- [ ] **Step 6: Commit**

Use a Lore commit with intent: `Make game-feel intensity deterministic and bounded`.

### Task 2: Emit One In-Game Record Event Per Run

**Files:**
- Modify: `src/features/game/store.ts`
- Modify: `src/features/game/__tests__/store.test.ts`
- Modify: `src/features/game/sound/useGameFeedback.ts`
- Modify: `src/features/game/__tests__/sounds.test.ts`

- [ ] **Step 1: Write failing store tests for active-run record state**

Add tests proving:

```ts
expect(useGameStore.getState().runBestAtStart).toBe(500);
expect(useGameStore.getState().recordCelebration).toBeNull();

// First crossing:
expect(useGameStore.getState().recordCelebration).toEqual({
  score: 501,
  previousBest: 500,
});

// Later score growth:
expect(useGameStore.getState().recordCelebration).toEqual(firstCelebration);

// Loading a saved score above current best:
expect(useGameStore.getState().recordCelebration).toBeNull();
```

Also prove `continueGame()` preserves that the celebration has already fired.

- [ ] **Step 2: Run store tests and verify RED**

Run: `npm test -- --runInBand src/features/game/__tests__/store.test.ts`

Expected: FAIL because active-run record presentation state does not exist.

- [ ] **Step 3: Implement presentation-only record state**

Add:

```ts
interface RecordCelebration {
  score: number;
  previousBest: number;
}

interface GameStore {
  runBestAtStart: number;
  recordCelebration: RecordCelebration | null;
  recordCelebrated: boolean;
}
```

At new-run start, capture `useScores.getState().best`. After an accepted placement,
compare the new score against `runBestAtStart`; set the celebration once without
changing engine state or leaderboard proof. On saved-run load, initialize
`recordCelebrated` so a historical crossing is not replayed.

- [ ] **Step 4: Move record sound trigger from terminal-only result to the one-shot active-run event**

Keep game-over behavior compatible: the sound must not play twice when the record was
already celebrated during play.

- [ ] **Step 5: Run store and sound tests and verify GREEN**

Run:

```powershell
npm test -- --runInBand src/features/game/__tests__/store.test.ts src/features/game/__tests__/sounds.test.ts
```

Expected: PASS; one record event and one sound trigger per run.

- [ ] **Step 6: Commit**

Use a Lore commit with intent: `Celebrate personal records when they happen`.

### Task 3: Make Clear Debris Fall Outside the Board

**Files:**
- Modify: `src/features/game/animation/clearPresentation.ts`
- Modify: `src/features/game/__tests__/clearPresentation.test.ts`
- Modify: `src/features/game/effects/ClearLayer.tsx`
- Modify: `src/features/game/effects/BlockCrushLayer.tsx`
- Modify: `src/features/game/effects/ClearDebrisLayer.tsx`
- Create: `src/features/game/effects/GameEffectsLayer.tsx`
- Modify: `src/features/game/components/BoardView.tsx`

- [ ] **Step 1: Write failing trajectory and layer-boundary tests**

Prove:

```ts
const presentation = buildClearPresentation(crossEvent(), GEOM, COLORS, false);
expect(presentation.debris.some((item) => item.dy > GEOM.boardSize)).toBe(true);
expect(presentation.fallingFragments.length).toBeLessThanOrEqual(
  GAME_FEEL_BUDGETS.maxOverflowFragments,
);

const reduced = buildClearPresentation(crossEvent(), GEOM, COLORS, true);
expect(reduced.debris.every(({ dy }) => dy === 0)).toBe(true);
expect(reduced.fallingFragments).toHaveLength(0);
```

Add a source-contract test proving the inner board keeps `overflow: 'hidden'`, while
`GameEffectsLayer` uses visible overflow and `pointerEvents="none"`.

- [ ] **Step 2: Run focused clear tests and verify RED**

Run: `npm test -- --runInBand src/features/game/__tests__/clearPresentation.test.ts`

Expected: FAIL because current trajectories remain local and all effects are clipped.

- [ ] **Step 3: Extend clear presentation with gravity-biased overflow effects**

Keep line highlight and initial crush readable inside the board. Generate a sampled,
capped external falling-fragment/debris set whose final `dy` passes the board bottom.
Use a two-stage path: small outward impulse followed by strong positive Y travel.

- [ ] **Step 4: Split clipped and visible-overflow rendering**

`ClearLayer` renders line highlights and board-clipped initial crush. `GameEffectsLayer`
is a sibling of the clipped board and renders falling fragments/debris using identical
board-relative coordinates. Preserve rounded board clipping for cells and highlights.

- [ ] **Step 5: Add lifecycle protection for rapid moves**

Key outer presentations by a stable event identity and expire them after the longest
configured duration. Verify cleanup prevents stale fragments and never blocks drag input.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```powershell
npm test -- --runInBand src/features/game/__tests__/clearPresentation.test.ts
npm run typecheck
```

Expected: PASS with no type errors.

- [ ] **Step 7: Commit**

Use a Lore commit with intent: `Let cleared blocks finish with a visible falling collapse`.

### Task 4: Add Placement Particles and Combo Frame Pulse

**Files:**
- Create: `src/features/game/effects/PlacementParticleLayer.tsx`
- Create: `src/features/game/effects/BoardFramePulse.tsx`
- Modify: `src/features/game/effects/GameEffectsLayer.tsx`
- Modify: `src/features/game/effects/useShake.ts`
- Modify: `src/features/game/components/BoardView.tsx`
- Modify: `src/features/game/__tests__/motion.test.ts`

- [ ] **Step 1: Write failing source and motion-budget tests**

Prove placement particles are capped, frame intensity starts at combo 2, shake starts at
combo 3 unless clear severity already requires it, and reduced motion removes travel and
shake.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm test -- --runInBand src/features/game/__tests__/gameFeelPresentation.test.ts src/features/game/__tests__/motion.test.ts
```

Expected: FAIL because render layers and combined severity do not exist.

- [ ] **Step 3: Implement placement particle rendering**

Render only immutable presentation data. Animate `opacity`, `translateX`,
`translateY`, and `scale`; do not animate position/layout props. Reduced motion renders a
short local glow instead of traveling particles.

- [ ] **Step 4: Implement combo frame and combined shake severity**

Frame pulse is a board-sized absolute overlay with a capped colored border/glow. Ensure
`useShake` cancels/restarts safely and always ends at translate `0`, scale `1`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the focused command from Step 2.

Expected: PASS with budgets and reduced-motion behavior enforced.

- [ ] **Step 6: Commit**

Use a Lore commit with intent: `Give accepted moves and combos a precise arcade response`.

### Task 5: Build the Animated Score and One-Shot Record Celebration

**Files:**
- Modify: `src/features/game/components/Hud.tsx`
- Create: `src/features/game/effects/NewRecordCelebration.tsx`
- Modify: `src/features/game/effects/Confetti.tsx`
- Modify: `src/core/i18n/en.ts`
- Modify: `src/core/i18n/ru.ts`
- Modify: `src/app/game.tsx`
- Modify: `src/features/game/__tests__/hud.test.ts`

- [ ] **Step 1: Write failing HUD and celebration contract tests**

Prove the HUD uses `scoreScaleFor(score)`, reserves stable score space, keys the pulse by
accepted score change, and reads persistent active-run record state. Prove record
confetti accepts deterministic pieces/count rather than using `Math.random()`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --runInBand src/features/game/__tests__/hud.test.ts`

Expected: FAIL because the score is currently static.

- [ ] **Step 3: Implement the score counter**

Use a fixed-size container sized for the maximum `1.25` scale. Animate only the inner
score text transform. Keep tabular numbers, no text input fallback, and no HUD layout
jump at tier boundaries.

- [ ] **Step 4: Implement the one-shot record celebration**

Mount a pointer-events-none overlay from `recordCelebration`. Show localized
`New record!`, a gold score pulse, and at most `18` deterministic gold confetti pieces.
Leave the score gold while `recordCelebrated` is true.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- --runInBand src/features/game/__tests__/hud.test.ts src/features/game/__tests__/store.test.ts
npm run typecheck
```

Expected: PASS with stable HUD layout.

- [ ] **Step 6: Commit**

Use a Lore commit with intent: `Make score growth and personal records visible during play`.

### Task 6: Add the Soft-Sunset Game Background

**Files:**
- Create: `src/features/game/components/GameBackground.tsx`
- Modify: `src/app/game.tsx`
- Modify: `src/features/game/index.ts`
- Create or modify: `src/features/game/__tests__/gameBackground.test.ts`

- [ ] **Step 1: Write a failing game-screen background contract test**

Prove the background is mounted only by `game.tsx`, contains the approved indigo,
peach/pink, and cool-indigo layers, uses `pointerEvents="none"`, and reacts only to combo
events. Prove normal play has no continuous repeating animation.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --runInBand src/features/game/__tests__/gameBackground.test.ts`

Expected: FAIL because the game-only background does not exist.

- [ ] **Step 3: Implement static soft-sunset layers and restrained combo pulse**

Use absolute `LinearGradient`/radial-like translucent circles behind content. Animate
only opacity/scale during a combo pulse. Keep the existing root gradient as opaque
fallback and do not alter other screens.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- --runInBand src/features/game/__tests__/gameBackground.test.ts src/app/__tests__/gameEntry.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Use a Lore commit with intent: `Give the game screen a restrained soft-sunset atmosphere`.

### Task 7: Integrate and Harden Rapid Event Sequences

**Files:**
- Modify: `src/features/game/components/BoardView.tsx`
- Modify: `src/features/game/effects/GameEffectsLayer.tsx`
- Modify: `src/features/game/effects/PraiseBanner.tsx`
- Modify: focused tests under `src/features/game/__tests__/`

- [ ] **Step 1: Add regression tests for consecutive event replacement**

Cover:

- no-clear placement followed immediately by clear;
- clear followed by another clear before the first effect expires;
- combo 3 followed by combo reset;
- record crossing during a clear;
- game over while effects are active;
- unmount while timers are active.

The source contract must show all timers return cleanup functions and all overlays are
non-interactive.

- [ ] **Step 2: Run focused tests and verify RED where lifecycle gaps exist**

Run: `npm test -- --runInBand src/features/game/__tests__`

Expected: any lifecycle regression fails before hardening changes.

- [ ] **Step 3: Harden keys, cancellation, z-index, and clipping**

Use stable event identity, clear timers on replacement/unmount, and define an explicit
layer order:

1. game background;
2. clipped board cells;
3. clipped line highlights;
4. outer fragments/placement particles/frame;
5. praise/score burst;
6. new-record celebration;
7. pause/game-over overlays.

Ensure no visual layer intercepts touches and no effect changes measured board origin.

- [ ] **Step 4: Run focused suite, typecheck, and lint**

Run:

```powershell
npm test -- --runInBand src/features/game/__tests__
npm run typecheck
npm run lint
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

Use a Lore commit with intent: `Keep overlapping game-feel events visually stable`.

### Task 8: Visual and Performance QA Gate

**Files:**
- Modify only files implicated by QA findings.
- Persist visual verdicts under `.omx/state/game-feel/ralph-progress.json` when running the visual loop.

- [ ] **Step 1: Run complete automated verification**

Run:

```powershell
npm test -- --runInBand
npm run typecheck
npm run lint
npm run backend:test
```

Expected: every command exits `0`, with zero Jest failures and zero lint/type errors.

- [ ] **Step 2: Build and open the web game for visual smoke testing**

Run the normal Expo web workflow. Verify there are no console errors, white gutters,
layout shifts, clipped praise, or blocked drag interactions.

- [ ] **Step 3: Capture required visual states**

Capture portrait frames for:

- ordinary placement at approximately `80–120 ms`;
- single-line clear at approximately `180`, `350`, and `700 ms`;
- combo 3+ with frame/background pulse;
- debris below the board;
- first record crossing and persistent gold score;
- score tiers below 1,000 and above 10,000;
- reduced motion;
- classic and Y2K themes.

- [ ] **Step 4: Run the visual-verdict loop**

Compare captures against the approved reference screenshots and the approved visual
companion direction. Require `visual-verdict` score `>= 90`. If any verdict is below
`90`, fix the listed differences and repeat capture/verdict before further unrelated
edits.

- [ ] **Step 5: Check performance and animated-view budgets**

On Android emulator/device, repeatedly trigger a cross or multi-line clear and rapidly
place the next piece. Confirm:

- drag remains responsive during effects;
- no obvious frame hitch or frozen animation;
- no stale particles/frame glow after the animation window;
- effect-view counts stay inside the declared budgets;
- no warning about state updates after unmount;
- transforms return exactly to identity.

If a hitch is visible, reduce sampled falling fragments/debris before reducing core line
readability or removing record/score feedback.

- [ ] **Step 6: Verify reduced motion and interruption scenarios**

Toggle reduced motion and repeat clear/combo/record scenarios. Pause during an active
effect, resume, trigger game over during an active effect, and leave the game screen.
Confirm no overlay leaks, touch interception, or replayed record celebration.

- [ ] **Step 7: Run final fresh verification after the last QA edit**

Repeat Step 1 after all visual/performance corrections. Do not claim completion from
earlier test output.

- [ ] **Step 8: Commit final QA corrections**

Use a Lore commit that records the exact devices/surfaces, visual-verdict result, and
known untested gaps.

## Final Acceptance Checklist

- [ ] Ordinary placement produces a precise, restrained particle response.
- [ ] Clear blocks visibly crush and finish with debris falling below the board.
- [ ] Combo frame/background pulse scales without obscuring board state.
- [ ] Score grows through the approved tiers without HUD layout movement.
- [ ] New record celebrates once during play and remains gold afterward.
- [ ] Soft-sunset background appears only on the game screen.
- [ ] Rapid moves, pause, game over, and unmount leave no stale visual state.
- [ ] Reduced motion preserves information and removes travel/shake.
- [ ] Visual-verdict score is at least `90`.
- [ ] Full tests, typecheck, lint, and backend tests pass from fresh output.
