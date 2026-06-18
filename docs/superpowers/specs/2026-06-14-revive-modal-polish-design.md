# Revive Modal Polish Design

## Goal

Make the game-over revive modal feel like a focused, polished rewarded-ad prompt.

## UI

- Replace the score label and value with the centered question `Хочешь продолжить?` / `Want to continue?`.
- Keep the understated `Нет` / `No` text action.
- Replace the generic yellow `GameButton` with a dedicated green revive button.
- The revive button uses a green gradient, depth/shadow, and a white custom SVG video-ad icon on the left.
- Label the primary action `Продолжить` / `Continue`.
- If revive has already been used, show `Игра окончена` / `Game over` and only the decline action.

## Behavior

The existing rewarded-ad loading, show, reward, and continue-game flows remain unchanged. The custom button is disabled while the rewarded ad is unavailable or another action is busy.

## Verification

Lock the new source contract with tests, run the full test/typecheck/lint suite, build a release APK, and visually inspect the modal on the Android emulator.
