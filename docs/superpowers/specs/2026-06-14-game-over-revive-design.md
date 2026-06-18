# Game Over Revive Overlay Design

## Goal

Make the game-over overlay match the focused Block Blast revive flow while preserving the final score.

## UI

- Show the final score label and score value.
- Show one prominent rewarded-ad button labeled with a play/ad cue and `Да` / `Yeah`.
- Show one understated text-style action labeled `Нет` / `No`.
- Remove the game-over title, weekly-impact card, record delta, share action, home action, and separate play-again button.

## Behavior

- The rewarded-ad action remains visible for the first game over, but is disabled while the ad is unavailable or an action is busy.
- A rewarded result continues the current game through the existing `continueGame()` flow.
- `Нет` starts a new game through the existing `onPlayAgain` callback.
- After a revive has already been used, only `Нет` is shown.
- Starting a new game may still show the existing interstitial according to monetization frequency rules.

## Scope

The change is limited to the game-over overlay and its localized labels. Existing game state, revive mechanics, monetization adapters, leaderboard submission, and share feature remain unchanged.

## Verification

- Add a source-level regression test that locks the intended overlay actions and removed content.
- Run the focused test, full Jest suite, TypeScript typecheck, and Expo lint.
