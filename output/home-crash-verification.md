# Adventure Home crash verification

Date: 2026-09-05

## Reproduction

Android API 29, Arrows_API_29, emulator-5556. Existing debug native build loaded
the current workspace JavaScript from Metro. Adventure level 7 → Settings → Home.

Before the fix, Fabric raised:

`addViewAt: cannot insert view [26] into parent [1014]: View already has a parent: [1018] Parent: SafeAreaView View: ReactViewGroup`

The mount dump in `home-crash-before-full.log` shows creation of playfield view
1014 and reparenting its header, objective and board children out of SafeAreaView
1018. Clearing the adventure run switches playfield pointerEvents from auto to
none while navigation removes the screen.

## Fix

Set `collapsable={false}` on the existing playfield View in
`src/app/adventure-level.tsx`. This keeps the native parent present across the
input-state change. Navigation and adventure-reset behavior are unchanged.

Add a regression case in `src/app/__tests__/adventureCompletion.test.tsx` that
presses Settings → Home, checks the native-parent contract before and after input
is disabled, verifies one navigation to `/`, and confirms the adventure run ends
without starting a new run or recording a win. It failed before the fix and passes
afterward.

## Validation

- Corrected Android bundle inspected: adventure playfield contains collapsable false.
- Android: direct level entry → Settings → Home succeeded.
- Android: Home → Adventure map → level 7 → Settings → Home succeeded again.
- App PID stayed 6358 across both successful exits.
- Home accessibility tree contains «Блок Бластик!» after the final exit.
- `home-crash-fixed-run.log`: zero addViewAt errors, native-call exceptions,
  fatal exceptions or fatal signals for that process.
- Screenshot: `home-crash-verified.png`.
- Jest: 131 suites, 877 tests passed.
- TypeScript: `tsc --noEmit` passed.
- ESLint: zero errors; two existing warnings in adventure/logic/seasons.ts and
  mascot/logic/types.ts.
- `git diff --check` passed for the changed source and test.

Physical Android devices and iOS were not tested. No store release was built.
