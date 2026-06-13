# Game Resume, Score HUD, Drag, and Audio Reliability Design

## Status

Approved direction: preserve the score and current tray when continuing after
Game Over, clear the blocked board, and allow this recovery once per run.

This document specifies the required behavior for:

- the temporary `0` shown by the score HUD;
- active-game resume and post-Game-Over Continue;
- local score, streak, and ranked-result accounting across Continue;
- drag reliability and performance;
- gameplay sound reliability and event mapping.

## Problem Statement

### Score HUD

The score at the top of the game can temporarily display `0` while the player
is inactive or holding a tray piece. The underlying game score is not lost.
The defect is presentation-only.

The current HUD renders the score through an `AnimatedTextInput` with
`defaultValue="0"` and a shared value initialized to `0`. Native remounts,
animated-prop refreshes, or timing interruptions can expose that default value
even though the Zustand game state still contains the correct score.

### Continue

The player expects Continue to preserve the current run. Continue must never
silently call `newGame()` or reset the score to zero.

Two different states can require Continue:

1. An active playable run that was left through Home, suspension, or process
   termination.
2. A terminal run whose board has no valid moves.

An active run can be restored exactly. A terminal run cannot resume on its
blocked board. It must first pass through the existing one-time Continue flow,
which clears the board while preserving the score and remaining tray pieces.

### Drag and Audio

Drag and sound currently have the right broad architecture, but release
validation must prove that:

- holding or moving a piece does not mutate or reset the score;
- drag remains on the UI thread;
- valid drops are committed exactly once;
- cancelled and invalid drops do not commit;
- pickup, drop, clear, Game Over, and record sounds play at the correct times;
- repeated interaction does not create noticeable input or audio lag.

## Goals

- The HUD always displays the authoritative game score.
- Continue never creates a new run implicitly.
- A playable saved run resumes exactly where it stopped.
- A terminal saved run returns to the Game Over state and can be continued once.
- Continuing clears the blocked board, preserves score and current tray, and
  prevents a second continuation.
- Ranked results remain frozen at the first Game Over.
- A continued run counts as one played game, not two.
- Drag stays responsive and deterministic.
- Gameplay sounds match gameplay events without duplicate playback.

## Non-Goals

- Do not change placement rules, shape generation, scoring formulas, or line
  clear effects.
- Do not add undo.
- Do not search for or generate a new "solvable" board at Continue time.
- Do not change the rewarded-ad policy for the Game Over Continue action.
- Do not allow more than one Continue per run.
- Do not submit post-Continue moves to the already frozen ranked proof.
- Do not add a new dependency.

## Product Decisions

### Continue Terminology

`Continue` means resume the same run. It never means start a new run.

- `Play` starts a new run only when no resumable state exists.
- `New game` and `Play again` explicitly discard the resumable state and start
  a new run.
- `Continue - <score>` on Home opens the saved run with that exact score.
- A saved terminal run opens the Game Over overlay. It does not expose the
  blocked board as playable.
- `Continue (ad)` on the Game Over overlay performs the one-time recovery after
  the reward is earned.

### One-Time Recovery

After a successful Game Over Continue:

- board: cleared to 64 empty cells;
- score: preserved exactly;
- tray: preserved exactly, including empty tray slots;
- RNG state: preserved;
- combo: reset to `0`;
- moves since clear: reset to `0`;
- status: changed to `playing`;
- `reviveUsed`: changed to `true`.

Resetting combo is required because clearing the board breaks the previous
placement chain. Preserving combo would grant an artificial multiplier after a
non-scoring board clear.

### Run Accounting

A continued run remains one local game and one ranked run.

- The first Game Over freezes and submits the ranked score exactly once.
- The first Game Over increments `gamesPlayed` exactly once and marks the daily
  streak.
- Continue does not start a new ranked proof and does not increment
  `gamesPlayed`.
- The second Game Over does not submit the ranked run again.
- The final post-Continue score may improve the local all-time best, but it
  must not increment `gamesPlayed` again.
- Sharing after the second Game Over uses the final preserved-and-extended
  score.

## Authoritative State Model

### Persisted Game State

`game.current` remains the authoritative saved run. It must contain both
`playing` and `over` states.

Current behavior removes `game.current` at Game Over. That must stop. A terminal
state is a valid resumable state because it carries the score, tray, RNG state,
and one-time Continue eligibility.

The serialized `GameState` remains version `v1` unless implementation requires
new persisted fields. Existing saves must continue to deserialize.

### Session Presentation State

`lastEvent` and `finalResult` are presentation state, not authoritative game
state. They may be absent after a cold process restart.

After loading a terminal save without `finalResult`:

- show a normal Game Over title;
- show the persisted score;
- show Continue eligibility from `reviveUsed`;
- do not replay confetti, record sound, Game Over sound, or line-clear effects;
- do not resubmit stats or ranked results.

### Resume Classification

The store exposes a pure resume classification derived from the serialized
save:

| Classification | Condition | Home action | Game action |
|---|---|---|---|
| `none` | no valid save | show `Play` | create a new run only after explicit Play |
| `active` | `status=playing` | show `Continue - score` | restore exact state |
| `terminal` | `status=over` | show `Continue - score` | restore Game Over overlay |

Invalid or corrupt saves are removed and treated as `none`.

### No Implicit New Game

Opening `/game` is not sufficient permission to start a new run.

The Game screen must receive or derive an explicit entry intent:

- `resume`: load the saved state; if unavailable, return Home or show a
  recoverable error;
- `new`: create a new run;
- `daily`: create the selected daily run.

The existing mount behavior, `if (!loadSaved()) newGame()`, is prohibited
because it converts any resume failure into silent progress loss.

## State Transitions

| From | Action | To | Score | Board | Tray | Ranked proof |
|---|---|---|---|---|---|---|
| no save | Play | playing | `0` | empty | new wave | start |
| playing | valid drop | playing | increased | placed/cleared | consume/refill | append move |
| playing | Home/background/kill | active save | unchanged | unchanged | unchanged | unchanged |
| active save | Continue | playing | unchanged | unchanged | unchanged | unchanged |
| playing | first Game Over | terminal save | final first score | blocked | remaining tray | freeze once |
| terminal save | Home Continue | Game Over overlay | unchanged | blocked, non-interactive | unchanged | no mutation |
| Game Over overlay | rewarded Continue | playing | unchanged | empty | unchanged | remains frozen |
| playing after Continue | valid drop | playing | increased | normal | normal | no appended ranked moves |
| playing after Continue | second Game Over | terminal final | final extended score | blocked | remaining tray | no resubmit |
| active/terminal save | New game / Play again | playing | `0` | empty | new wave | start new proof |

## Score HUD Design

### Authoritative Rendering

The visible score must render directly from:

```ts
useGameStore((state) => state.game.score)
```

The primary score text must not use a native text input, `defaultValue`, or a
separate numeric state that can diverge from the store.

The approved baseline is a normal `AppText` score. Reliability is more
important than tweening every numeric increment.

If a future animated counter is introduced, it must:

- initialize from the current score, never zero;
- render the authoritative score on mount and interruption;
- never depend on `defaultValue`;
- have a regression test for remount and long press;
- degrade to the exact store score when animation is cancelled.

### HUD Acceptance Rules

- Holding a figure for at least 10 seconds does not change the displayed score.
- Leaving the game idle for at least 60 seconds does not change the displayed
  score.
- Opening and closing Pause does not display zero.
- Backgrounding and foregrounding the app does not display zero.
- Resume from Home immediately displays the persisted score.
- Score changes only after a successful placement event.

## Continue and Persistence Design

### Store Responsibilities

The game store must provide explicit operations with no hidden fallback:

```ts
type ResumeKind = 'none' | 'active' | 'terminal';

interface SavedGameSummary {
  kind: ResumeKind;
  score: number | null;
  canContinue: boolean;
}

getSavedGameSummary(): SavedGameSummary;
loadSaved(): 'active' | 'terminal' | null;
continueGame(): boolean;
discardAndStartNew(options?: NewGameOptions): void;
```

Behavior:

- `getSavedGameSummary` reads and validates `game.current` without mutating the
  live store. `canContinue` is true for active games and for terminal games
  with `reviveUsed=false`.
- `loadSaved` restores either a playable or terminal save and never creates a
  new game.
- `continueGame` succeeds only for `status=over && reviveUsed=false`; it applies
  the approved recovery and persists the resulting playable state.
- `discardAndStartNew` is the only path that replaces an existing save with a
  fresh run.

Function names may follow existing project conventions, but these
responsibilities must remain separate.

### Autosave Rules

Persist `game.current`:

- immediately after explicit new-game creation;
- after every successful placement;
- after the first and second Game Over;
- immediately after successful Continue.

Do not write a save:

- during drag updates;
- on pickup;
- on invalid or cancelled drop;
- because the HUD renders;
- because audio plays.

### Corrupt Save Handling

If deserialization fails:

- remove the invalid `game.current`;
- report `ResumeKind='none'`;
- do not silently create a game until the player taps Play;
- do not crash Home or Game.

## Home and Game Over UX

### Home

When an active save or a terminal save with unused recovery exists, Home shows:

```text
Continue - <score>
New game
```

- Active save: Continue opens playable gameplay.
- Terminal save: Continue opens the Game Over overlay with the blocked board
  non-interactive behind it.
- New game always asks for confirmation when a valid save exists.
- A terminal save with `reviveUsed=true` is final and must not be presented as
  continuable. Home shows `Play`/`New game`, and that explicit action replaces
  the final save.

### Game Over Overlay

For `reviveUsed=false`:

- show `Continue (ad)` only when rewarded Continue is available;
- after reward, call the explicit one-time Continue operation;
- never call `newGame()` from the Continue handler.

For `reviveUsed=true`:

- do not show Continue;
- `Play again` starts a new run;
- `Home` preserves the terminal final state for result integrity, but Home does
  not label it as continuable.

If a terminal state is restored after process death, the overlay must not
repeat Game Over accounting or sounds.

## Ranked and Local Result Integrity

### Ranked Proof

The ranked proof is immutable after the first Game Over:

- `frozenScore` remains the first Game Over score;
- `finishedAt` remains the first Game Over time;
- post-Continue moves are not appended;
- no second pending submission is created;
- retrying an existing queued submission remains allowed.

### Local Scores

Local score accounting must separate:

1. first-run completion accounting;
2. best-score improvement after Continue.

Required effects:

| Event | Increment games played | Update best | Mark streak |
|---|---:|---:|---:|
| first Game Over | once | yes | once |
| successful Continue | no | no | no |
| second Game Over | no | yes, if higher | no |
| cold restore of terminal save | no | no | no |

No lifecycle action may count the same run twice.

## Drag Reliability Contract

### Input and Threading

- `Gesture.Pan` position, scale, preview, and validity calculations stay on the
  UI thread.
- `onUpdate` performs no React state updates, MMKV writes, audio calls, or
  `runOnJS`.
- A valid completed drop performs exactly one `runOnJS` call to commit the
  placement.
- Pickup may perform one separate `runOnJS` call for pickup feedback.
- Cancelled and invalid drops perform zero placement commits.

### Interaction Rules

- A long press without movement keeps the piece held and leaves score/store
  unchanged.
- A cancelled gesture returns the piece to its slot and clears preview.
- An invalid drop returns the piece to its slot and clears preview.
- A valid drop consumes the piece exactly once.
- Disabled pieces cannot start a drag.
- Board preview never remains visible after finalize.
- Board geometry and slot measurements must be refreshed after layout changes
  before accepting a drop.

### Performance Budgets

- Target: stable 60 fps on the existing Android emulator and a mid-range
  Android device.
- No React re-render caused by every drag frame.
- No JS bridge call during `onUpdate`.
- Invalid-drop return begins within one rendered frame after release.
- A valid drop's state update is visible within 100 ms of release, excluding
  intentional clear animation.
- Holding a piece for 10 seconds does not increase score, create saves, or
  trigger repeated sounds.

## Audio Reliability Contract

### Event-to-Sound Matrix

| Event | Sound | Count |
|---|---|---:|
| drag starts on enabled piece | `pickup` | once per gesture |
| cancelled/invalid drop | none after pickup | zero |
| valid placement without clear | `drop` | once |
| valid placement clearing one line | `clear1` | once |
| valid placement clearing two lines | `clear2` | once |
| valid placement clearing three or more lines / high combo | `clear3` | once |
| placement causing Game Over | `gameover` | once, instead of drop/clear |
| first Game Over creates new local record | `record` | once after configured delay |
| restored terminal save | none | zero |
| successful Continue | none | zero |

### Playback Rules

- Players are preloaded once when entering gameplay.
- Playback does not create a new player during gameplay.
- Sound-disabled settings suppress every gameplay sound, including pickup and
  delayed record fanfare.
- A delayed record sound is cancelled when its owning screen/effect unmounts
  or the relevant result is cleared.
- Sound failures remain non-fatal.
- Audio work never runs from drag `onUpdate`.
- Rapid placements must restart the intended player cleanly without causing a
  growing queue or blocking input.

### Audio Validation

Because automated tests cannot prove perceived latency, release validation must
include audible manual checks with sound enabled and disabled. Any missed,
duplicated, clipped, or delayed sound beyond approximately 150 ms from its
event is a release blocker.

## Error Handling

- Failed save reads: treat as no save, remove corrupt data, do not crash.
- Failed save writes: keep the in-memory run playable; do not reset score.
- Failed rewarded ad: remain on Game Over; do not clear the board and do not
  consume Continue.
- Dismissed rewarded ad: same behavior as failed rewarded ad.
- Duplicate rewarded callback: Continue remains idempotent and succeeds once.
- Duplicate placement callback: engine/store rejects the second placement
  because the tray slot is already empty; no duplicate score or sound.
- Route opened with resume intent and no valid save: return Home or show an
  explicit recoverable state; never call `newGame()` automatically.

## Instrumentation for Validation

Temporary development-only instrumentation may record:

- resume classification;
- save writes by reason;
- placement commit count;
- audio event name and timestamp;
- first and second Game Over accounting;
- frame stats during drag.

Instrumentation must not log every drag frame and must be removed or disabled
in release builds.

## Automated Test Plan

### Engine Tests

- Continue from an `over` state clears the board.
- Continue preserves score, tray, color IDs, and RNG state.
- Continue resets combo and moves-since-clear.
- Continue sets `status=playing` and `reviveUsed=true`.
- A second Continue attempt is rejected.

### Serialization Tests

- A playable state round-trips with the exact score.
- A terminal state round-trips and remains terminal.
- A continued state round-trips with `reviveUsed=true`.
- Existing v1 saves remain readable.
- Corrupt saves are rejected.

### Game Store Tests

- First Game Over persists terminal `game.current` instead of deleting it.
- Saved summary classifies active and terminal saves correctly.
- Saved summary reports final `reviveUsed=true` terminal saves as
  `canContinue=false`.
- `loadSaved` restores active save without creating a new run.
- `loadSaved` restores terminal save without creating a new run.
- Resume failure does not call `newGame`.
- Continue preserves score and tray, clears board, and writes a playable save.
- Continue is idempotent.
- First Game Over increments games played once and freezes ranked score once.
- Second Game Over after Continue does not increment games played or submit a
  second ranked result.
- Second Game Over may improve local best.
- Cold-loading a terminal save does not repeat stats, streak, analytics, audio,
  or ranked submission.

### HUD Tests

- HUD renders the current store score on initial mount.
- HUD renders a non-zero restored score immediately.
- HUD does not contain a score `TextInput` or `defaultValue="0"`.
- Store updates change the displayed score.

### Drag Tests

- Long hold does not call placement.
- Invalid finalize clears preview and does not call placement.
- Cancelled finalize clears preview and does not call placement.
- Valid finalize calls placement once.
- Preview mask and board-fit calculations remain correct at boundaries.
- Drag update path contains no persistence or audio playback.

### Audio Tests

- Sound mapper selects exactly one sound for every placement event.
- Game Over takes precedence over clear/drop.
- Clear tier selection remains deterministic.
- Sound disabled suppresses pickup, placement, Game Over, and record sounds.
- Restoring terminal state does not emit Game Over or record sound.
- Delayed record playback is cancelled when result state changes.

## Manual Release Validation

Run on a release Android build, not only Expo development mode.

### Score HUD Matrix

1. Reach a non-zero score.
2. Hold each available piece for at least 10 seconds.
3. Leave the game idle for at least 60 seconds.
4. Open and close Pause.
5. Background for 30 seconds and foreground.
6. Return Home and tap Continue.
7. Confirm the score never shows `0` unless the actual run score is zero.

### Continue Matrix

1. Active run → Home → Continue:
   exact board, tray, and score restored.
2. Active run → force-stop → Continue:
   exact board, tray, and score restored.
3. First Game Over → Home → Continue:
   Game Over overlay restored; blocked board is not interactive.
4. Earn rewarded Continue:
   board clears; score and tray remain; combo resets.
5. Force-stop immediately after Continue:
   cleared playable board and preserved score restore.
6. Reach second Game Over:
   Continue is absent; score remains final; games played increased only once.
7. Start New game:
   score becomes zero only after explicit confirmation.

### Drag Matrix

- Drag slowly across every board edge.
- Rapidly pick up and cancel each tray slot.
- Hold a piece without moving.
- Drop on occupied cells and outside the board.
- Perform at least 30 rapid valid placements.
- Verify no stuck preview, duplicated placement, score reset, or visible lag.

### Audio Matrix

- Validate every event in the sound matrix with sound enabled.
- Repeat with sound disabled.
- Rapidly place pieces and confirm sounds do not queue or lag behind input.
- Trigger Game Over and confirm no simultaneous drop/clear sound.
- Restore a terminal save and confirm Game Over/record sounds do not replay.

### Performance Capture

- Use Android GPU/profile tooling or `adb shell dumpsys gfxinfo`.
- Capture a long hold, continuous drag, invalid return, valid drop, and line
  clear.
- Any repeatable input hitch, frame stall, or audio-triggered lag is a release
  blocker.

## Acceptance Criteria

- The HUD never visually shows `0` while authoritative score is non-zero.
- Continue never implicitly starts a new game.
- Active saves restore exact board, tray, score, RNG, combo, and status.
- Terminal saves restore the Game Over overlay without becoming playable.
- Home never offers Continue for a terminal save whose one-time recovery was
  already used.
- Rewarded Continue clears the blocked board while preserving score and tray.
- Continue can succeed only once per run.
- Combo is zero after Continue.
- Ranked result is frozen and submitted exactly once at first Game Over.
- Continued runs increment `gamesPlayed` exactly once.
- Final post-Continue score can improve local best without changing ranked
  score.
- Drag commits valid placements exactly once and never commits invalid or
  cancelled drops.
- Drag update performs no JS bridge work, persistence, or audio playback.
- Sound mapping matches the event table with no duplicates or replay on resume.
- Frontend tests, typecheck, lint, release build, Android smoke, drag smoke, and
  audio smoke pass.

## Expected Files for Implementation

Likely modifications:

- `src/features/game/components/Hud.tsx`
- `src/features/game/store.ts`
- `src/features/game/components/GameOverOverlay.tsx`
- `src/app/index.tsx`
- `src/app/game.tsx`
- `src/core/engine/game.ts`
- `src/core/storage/index.ts`
- `src/features/scores/store.ts`
- `src/features/game/drag/useDrag.ts`
- `src/features/game/sound/sounds.ts`
- `src/features/game/sound/useGameFeedback.ts`
- `src/core/i18n/ru.ts`
- `src/core/i18n/en.ts`

Likely test modifications or additions:

- `src/core/engine/__tests__/game.test.ts`
- `src/core/engine/__tests__/serialize.test.ts`
- `src/features/game/__tests__/store.test.ts`
- `src/features/scores/__tests__/store.test.ts`
- `src/features/game/__tests__/gridMath.test.ts`
- new HUD, drag lifecycle, and audio-event tests under
  `src/features/game/__tests__/`
