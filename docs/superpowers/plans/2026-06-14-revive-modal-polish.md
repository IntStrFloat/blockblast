# Revive Modal Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the score-focused game-over modal with a polished rewarded-ad continuation prompt.

**Architecture:** Create a focused `ReviveButton` component containing its presentation and SVG icon. Keep ad orchestration in `GameOverOverlay`, which selects the localized prompt based on whether revive is still available.

**Tech Stack:** Expo SDK 56, React Native, expo-linear-gradient, react-native-svg, Jest

---

### Task 1: Lock the prompt contract

**Files:**
- Modify: `src/features/game/__tests__/gameOverOverlaySource.test.ts`

- [ ] Assert that the overlay renders `gameOver.revivePrompt`, uses `ReviveButton`, and no longer renders `gameOver.score` or `game.score`.
- [ ] Run `npx jest src/features/game/__tests__/gameOverOverlaySource.test.ts --runInBand` and confirm failure.

### Task 2: Build the custom revive action

**Files:**
- Create: `src/features/game/components/ReviveButton.tsx`
- Modify: `src/features/game/components/GameOverOverlay.tsx`
- Modify: `src/core/i18n/en.ts`
- Modify: `src/core/i18n/ru.ts`

- [ ] Add a green gradient pressable with a white video-ad SVG icon, centered label, shadow, and disabled styling.
- [ ] Replace the score block with the localized prompt and use the existing game-over title after revive is consumed.
- [ ] Change the rewarded action label to `Продолжить` / `Continue`.
- [ ] Run the focused test and confirm it passes.

### Task 3: Verify

**Files:**
- No additional files

- [ ] Run `npx jest --runInBand`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run Android `assembleRelease`, install it, and inspect the modal on the emulator.
