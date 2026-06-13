# Block Blast Spectacle Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved maximum-spectacle line-clear choreography, remove the white web background, and replace technical leaderboard status language.

**Architecture:** Pure deterministic presentation helpers will convert `PlacementEvent` data and board geometry into line segments, intersections, crush quadrants, debris, shake severity, and praise sizing. Focused Reanimated layers will consume that immutable data while board state remains authoritative and interactive. Expo Router root HTML will provide the web background before hydration.

**Tech Stack:** Expo SDK 56, Expo Router static web, React Native 0.85, Reanimated 4, Expo LinearGradient, Jest.

---

### Task 1: Fix Web Chrome And Player-Facing Status

**Files:**
- Create: `src/app/+html.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/features/leaderboard/components/WeeklyCard.tsx`
- Modify: `src/core/i18n/ru.ts`
- Modify: `src/core/i18n/en.ts`
- Test: `src/features/leaderboard/__tests__/presentation.test.ts`

- [ ] **Step 1: Write failing tests for status presentation**

Test a pure `weeklyStatusLabel` helper so remote data returns `null`, cached data returns saved-results language, and offline data returns offline language.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx jest src/features/leaderboard/__tests__/presentation.test.ts --runInBand
```

Expected: FAIL because the presentation helper does not exist.

- [ ] **Step 3: Implement the helper and remove technical copy**

Render no top-right status for current remote data. Render only localized `offline` and `savedResults` labels for degraded states.

- [ ] **Step 4: Add opaque root HTML background**

Create `+html.tsx` using `ScrollViewStyleReset` and an inline style for `html`, `body`, and `#root`. Give the native root layout an opaque fallback beneath the gradient.

- [ ] **Step 5: Verify GREEN and static HTML output**

Run:

```powershell
npx jest src/features/leaderboard/__tests__/presentation.test.ts --runInBand
npx expo export --platform web --output-dir web-dist
Select-String web-dist/index.html -Pattern '#0f1b33'
Select-String web-dist/index.html -Pattern 'backend'
```

Expected: tests PASS, background CSS is present, and player-facing HTML contains no `backend`.

### Task 2: Build Deterministic Clear Presentation

**Files:**
- Create: `src/features/game/animation/clearPresentation.ts`
- Test: `src/features/game/__tests__/clearPresentation.test.ts`
- Modify: `src/features/game/animation/motion.ts`

- [ ] **Step 1: Write failing geometry tests**

Cover exact cell alignment, 8 row segments, 8 column segments, one deduplicated intersection, deterministic output, fragment travel limits, debris cap `56`, shake severity, praise cap, and reduced-motion output.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx jest src/features/game/__tests__/clearPresentation.test.ts --runInBand
```

Expected: FAIL because `clearPresentation.ts` does not exist.

- [ ] **Step 3: Implement pure presentation builders**

Use a seeded PRNG based on event rows, columns, cells, color IDs, score, and combo. Return immutable arrays for lines, intersections, quadrants, debris, sparks, centroid, shake, and praise.

- [ ] **Step 4: Run tests and verify GREEN**

Run the targeted test and existing motion tests. Expected: PASS.

### Task 3: Render Cell-Aligned Highlight And Trails

**Files:**
- Create: `src/features/game/effects/LineHighlightLayer.tsx`
- Modify: `src/features/game/components/BoardView.tsx`
- Modify: `src/features/game/effects/ClearLayer.tsx`

- [ ] **Step 1: Replace freehand flashes with presentation data**

Render one underglow per completed axis, eight crisp contour segments per row or column, one flare per unique intersection, and one axis trail.

- [ ] **Step 2: Preserve exact geometry**

All `left`, `top`, `width`, and `height` values must come from `cell`, `gap`, and presentation data. Contours are inset one pixel and retain block corner radius.

- [ ] **Step 3: Verify typecheck and targeted tests**

Run:

```powershell
npm run typecheck
npx jest src/features/game/__tests__/clearPresentation.test.ts --runInBand
```

Expected: PASS.

### Task 4: Render Four-Part Block Crush And Axis Debris

**Files:**
- Create: `src/features/game/effects/BlockCrushLayer.tsx`
- Create: `src/features/game/effects/ClearDebrisLayer.tsx`
- Modify: `src/features/game/components/BoardView.tsx`
- Delete: `src/features/game/effects/Particles.tsx`

- [ ] **Step 1: Render four visual quadrants per cleared block**

Each quadrant uses the original block color with matching highlight/shade geometry. Animate compression, separation, rotation, scale, and opacity using deterministic presentation values.

- [ ] **Step 2: Render bounded debris and sparks**

Render at most `56` axis-biased square fragments and six white sparks. Reduced motion uses at most `12` fragments and no travel.

- [ ] **Step 3: Remove the superseded generic effects**

Delete the old whole-cell collapse and generic particle layer after the replacement is wired.

- [ ] **Step 4: Verify typecheck, tests, and lint**

Expected: all commands exit `0`.

### Task 5: Add Severity Shake And Spectacle Praise

**Files:**
- Modify: `src/features/game/effects/useShake.ts`
- Modify: `src/features/game/effects/PraiseBanner.tsx`
- Modify: `src/features/game/components/BoardView.tsx`
- Modify: `src/app/game.tsx`
- Test: `src/features/game/__tests__/clearPresentation.test.ts`

- [ ] **Step 1: Drive shake from presentation severity**

One line uses a small nudge, two lines use `3 px`, three use `4 px + 1.01`, and four/full clear use `5 px + 1.015`. Always return to identity.

- [ ] **Step 2: Layer praise typography**

Render extrusion, glow, body, and highlight copies with board-size-bounded typography. Add a combo line for combo `>=2` and a score burst from the clear centroid.

- [ ] **Step 3: Respect system reduced motion**

Use React Native `AccessibilityInfo.isReduceMotionEnabled()` with a listener. Disable shake/travel and reduce debris while retaining a short contour pulse and readable praise.

- [ ] **Step 4: Verify tests and accessibility paths**

Run targeted tests, typecheck, and lint. Expected: PASS.

### Task 6: Verify, Build, Deploy, And Publish

**Files:**
- Modify: `docs/specs/04-design-system.md`
- Modify: `docs/specs/00-game-analysis.md`

- [ ] **Step 1: Update design documentation**

Record researched current original version/date, inferred timing caveat, exact spectacle phases, web fix, and player-facing status language.

- [ ] **Step 2: Run the complete verification suite**

Run:

```powershell
npm test -- --runInBand
npm run typecheck
npm run lint
npm run backend:test
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 3: Verify web visually**

Export production web, serve it, and inspect portrait and desktop. Confirm dark background before hydration, no white gutters, no `backend`, and no console errors.

- [ ] **Step 4: Verify Android visually**

Build and install release APK. Trigger at least one clear and capture the line-lock, crush/trail, and praise states. Confirm drag remains responsive.

- [ ] **Step 5: Build signed APK artifacts and deploy web**

Produce universal and arm64 APKs, verify signatures, deploy static web through Paramiko, and confirm `/api/health`.

- [ ] **Step 6: Commit and push**

Use a Lore-format commit that records current-original research limits, geometry constraints, rejected alternatives, verification, and the untested iOS physical-device gap.
