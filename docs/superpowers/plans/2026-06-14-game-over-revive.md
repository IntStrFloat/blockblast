# Game Over Revive Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crowded game-over menu with a score, rewarded revive action, and new-game decline action.

**Architecture:** Keep the existing `GameOverOverlay` state and monetization orchestration, but reduce its rendered surface. Reuse `GameButton`, `continueGame()`, and `onPlayAgain` rather than introducing new behavior or dependencies.

**Tech Stack:** Expo SDK 56, React Native, TypeScript, Jest

---

### Task 1: Lock the overlay contract

**Files:**
- Create: `src/features/game/__tests__/gameOverOverlaySource.test.ts`

- [ ] **Step 1: Write a failing source-level regression test**

Assert that the overlay uses `gameOver.score`, `gameOver.revive`, and `gameOver.decline`, while no longer importing leaderboard/share UI or rendering the removed labels.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --runInBand src/features/game/__tests__/gameOverOverlaySource.test.ts`

Expected: FAIL because the overlay still renders weekly impact, share, home, and play-again actions.

### Task 2: Simplify the overlay

**Files:**
- Modify: `src/features/game/components/GameOverOverlay.tsx`
- Modify: `src/core/i18n/en.ts`
- Modify: `src/core/i18n/ru.ts`

- [ ] **Step 1: Remove obsolete overlay dependencies and rendered sections**

Keep the score, rewarded-ad flow, interstitial-aware new-game flow, and confetti. Remove leaderboard impact, share, home, title, record delta, and separate play-again UI.

- [ ] **Step 2: Add localized `accept` and `decline` labels**

Use `Yeah` / `No` in English and `Да` / `Нет` in Russian.

- [ ] **Step 3: Keep revive visible but disabled before rewarded readiness**

Render it whenever revive has not been used; disable it when busy or unavailable.

- [ ] **Step 4: Run focused test**

Run: `npm test -- --runInBand src/features/game/__tests__/gameOverOverlaySource.test.ts`

Expected: PASS.

### Task 3: Verify the project

**Files:**
- No additional files

- [ ] **Step 1: Run all tests**

Run: `npm test -- --runInBand`

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Run lint**

Run: `npm run lint`
