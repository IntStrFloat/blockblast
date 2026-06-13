# Game Resume, Score, Drag, and Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make saved runs resume without progress loss, keep the HUD authoritative, account for one-time Continue correctly, and prove drag/audio reliability.

**Architecture:** Keep `GameState` save version `v1` and use `reviveUsed` to distinguish first and second Game Over accounting. Add explicit route entry intents and explicit store operations for save classification, loading, continuing, and replacement. Keep drag frame work on the UI thread and move audio selection into pure tested functions.

**Tech Stack:** Expo SDK 56, Expo Router, Zustand, MMKV, React Native Gesture Handler, Reanimated, expo-audio, Jest.

---

## File Structure

- `src/core/engine/game.ts`: validate and apply one-time Continue recovery.
- `src/core/engine/serialize.ts`: validate v1 active, terminal, and continued saves.
- `src/core/engine/__tests__/game.test.ts`: recovery invariants and rejection tests.
- `src/core/engine/__tests__/serialize.test.ts`: active, terminal, continued, legacy, and corrupt save coverage.
- `src/features/scores/store.ts`: separate first completion accounting from later best improvement.
- `src/features/scores/__tests__/store.test.ts`: prove best-only updates do not increment games.
- `src/features/game/store.ts`: save summary, explicit load/new/continue, terminal persistence, and one-time accounting.
- `src/features/game/__tests__/store.test.ts`: resume classification, terminal restore, corrupt saves, Continue, and first/second Game Over.
- `src/app/index.tsx`: Home decisions from `SavedGameSummary` and explicit route intents.
- `src/app/game.tsx`: execute only explicit `resume`, `new`, or `daily` entry intent.
- `src/features/game/components/Hud.tsx`: render the store score with `AppText`.
- `src/features/game/components/GameOverOverlay.tsx`: rewarded Continue calls only `continueGame`.
- `src/features/game/__tests__/hud.test.ts`: authoritative score source and no TextInput/default zero regression.
- `src/features/game/drag/useDrag.ts`: preserve one pickup bridge call and one valid-drop commit.
- `src/features/game/drag/dropLifecycle.ts`: pure drop commit decision used by the worklet.
- `src/features/game/__tests__/dragLifecycle.test.ts`: hold, invalid, cancelled, valid, and source-contract checks.
- `src/features/game/sound/sounds.ts`: deterministic placement-event sound mapping.
- `src/features/game/sound/useGameFeedback.ts`: cancellation-safe delayed record playback.
- `src/features/game/__tests__/sounds.test.ts`: precedence, clear tiers, and disabled/restored behavior helpers.
- `src/core/i18n/en.ts`, `src/core/i18n/ru.ts`: explicit resume failure copy if needed.

### Task 1: Engine Continue Contract

- [ ] Add failing tests proving Continue clears the board, preserves score/tray/colors/RNG, resets combo and moves, marks `reviveUsed`, and rejects invalid/second attempts.
- [ ] Run `npm test -- src/core/engine/__tests__/game.test.ts --runInBand` and confirm the new assertions fail.
- [ ] Change `revive(state)` to return `GameState | null`, validate `status === 'over' && !reviveUsed`, and apply the exact recovery state.
- [ ] Re-run the engine test and confirm it passes.

### Task 2: Serialization Coverage

- [ ] Add failing/coverage tests for exact active, terminal, and continued round trips plus existing `v1` compatibility and corrupt saves.
- [ ] Run `npm test -- src/core/engine/__tests__/serialize.test.ts --runInBand`.
- [ ] Tighten deserialization validation only where a test exposes an invalid accepted save; do not change the save version.
- [ ] Re-run the serialization tests.

### Task 3: Local Score Accounting

- [ ] Add a failing test for `improveBest(score)` updating best without incrementing `gamesPlayed` or `totalLinesCleared`.
- [ ] Run `npm test -- src/features/scores/__tests__/store.test.ts --runInBand` and confirm failure.
- [ ] Implement `improveBest(score): SubmitResult` using the same result semantics as `submitGame`.
- [ ] Re-run the score tests.

### Task 4: Explicit Saved-Run Store

- [ ] Replace old store tests with failing tests for `getSavedGameSummary`, active/terminal `loadSaved`, corrupt removal, explicit new-game replacement, terminal persistence, Continue idempotence, and first/second Game Over accounting.
- [ ] Run `npm test -- src/features/game/__tests__/store.test.ts --runInBand` and confirm expected failures.
- [ ] Add:

```ts
export type ResumeKind = 'none' | 'active' | 'terminal';
export interface SavedGameSummary {
  kind: ResumeKind;
  score: number | null;
  canContinue: boolean;
}
```

- [ ] Implement `getSavedGameSummary()` as a storage-only classification that removes corrupt data.
- [ ] Implement `loadSaved(): Exclude<ResumeKind, 'none'> | null` without any new-game fallback.
- [ ] Implement `continueGame(): boolean` using the engine recovery and immediate persistence.
- [ ] Implement `discardAndStartNew(options?)` as the only replacement path and retain `newGame` only as a compatibility alias if required by unaffected callers.
- [ ] Persist terminal state on every Game Over.
- [ ] On first Game Over, call `submitGame`, freeze ranked proof, and mark streak once.
- [ ] On second Game Over, call only `improveBest`; do not finish ranked proof or mark streak.
- [ ] Re-run game-store, score, streak, and leaderboard tests.

### Task 5: Explicit Navigation and HUD

- [ ] Add a failing HUD regression test that proves `Hud.tsx` has no `TextInput`, `AnimatedTextInput`, or `defaultValue="0"` and renders `game.score`.
- [ ] Run `npm test -- src/features/game/__tests__/hud.test.ts --runInBand`.
- [ ] Replace the animated score input with `<AppText preset="score">{score}</AppText>`.
- [ ] Update Home to classify saves on focus, show Continue only when eligible, confirm replacement when a valid save exists, and route with explicit entry params.
- [ ] Update Game to handle `entry=resume|new|daily`; on failed resume, return Home without calling new-game creation.
- [ ] Keep terminal restored boards non-interactive behind the Game Over overlay.
- [ ] Distinguish fresh Game Over from restored terminal presentation so restore is immediate and does not repeat ad accounting, effects, or sounds.
- [ ] Require the same replacement confirmation for weekly new game, daily challenge, and final-terminal replacement.
- [ ] Update Game Over rewarded handling to call `continueGame()` and rely on its idempotence.
- [ ] Run HUD, store, i18n, and navigation tests.

### Task 6: Drag Contract

- [ ] Add failing pure tests for no commit on hold/invalid/cancelled lifecycle and exactly one commit payload for a valid finalized drop.
- [ ] Add a source-contract test proving the `.onUpdate` block contains no `runOnJS`, persistence, audio, or React state calls.
- [ ] Run `npm test -- src/features/game/__tests__/dragLifecycle.test.ts --runInBand`.
- [ ] Add a small worklet-safe drop decision helper and use it in `useDrag`.
- [ ] Preserve preview cleanup in both `onEnd` and `onFinalize`, pickup feedback once, and one placement bridge call for valid completion.
- [ ] Verify `BoardView` and `TrayPiece` remeasure window geometry from their layout callbacks.
- [ ] Re-run drag lifecycle and grid math tests.

### Task 7: Audio Contract

- [ ] Add failing tests for drop, clear1, clear2, clear3/high-combo, and Game Over precedence.
- [ ] Run `npm test -- src/features/game/__tests__/sounds.test.ts --runInBand`.
- [ ] Implement `soundForPlacement(event)` as a pure mapper.
- [ ] Use the mapper from `useGameFeedback`, keep sound-disabled checks outside playback, and include all delayed-record dependencies so cleanup cancels stale fanfare.
- [ ] Confirm terminal restore and Continue leave `lastEvent`/`finalResult` empty and therefore emit no gameplay sound.
- [ ] Re-run audio and game-store tests.

### Task 8: Full Verification

- [ ] Run `npm test -- --runInBand`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run backend:test`.
- [ ] Inspect `git diff --check` and the complete diff for unrelated changes.
- [ ] Fix every failure and repeat the relevant full command.

### Task 9: Android Release and Integration

- [ ] Verify the Android toolchain and signing configuration.
- [ ] Build a universal release APK with all configured ABIs using `android/gradlew.bat assembleRelease`.
- [ ] Locate the APK, inspect its size, and verify its signature/package metadata with available Android SDK tools.
- [ ] Install the release APK on an available emulator/device and run the HUD, Continue, drag, and audio manual matrices.
- [ ] Capture frame data with `adb shell dumpsys gfxinfo`; treat repeatable stalls or input/audio lag as release blockers.
- [ ] Review the full diff, confirm all intended dirty files are included, and confirm no merge conflicts before integration.
- [ ] Commit implementation with a Lore-format message including verification trailers.
- [ ] Push `codex/weekly-leaderboards-retention`.
- [ ] Merge the feature branch into `main` non-interactively, preserving the user's existing `app.json` and icon changes.
- [ ] Push `main`.
- [ ] Report the absolute APK path, commit hashes, pushed branches, verification evidence, changed files, simplifications, and remaining manual device/audio risks.
