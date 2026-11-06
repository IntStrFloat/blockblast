# Test migration

The old UI source-string assertions fixed obsolete colors, typography, Home
layout, gear position, revive-result buttons, map links and onboarding gates.
These are replaced by the supplied Night Candy flows. Retired those checks
instead of rewriting regular expressions to mirror the new implementation.
The old collection slot-preview test exercised a removed intermediate screen.

Keep real engine, save compatibility, helper balance/receipts, reward settlement,
notification consent, ad frequency/impression and screen transition tests. Native
visual review and frame recordings are required separately; Jest animation mocks
cannot establish pixel fidelity or smoothness.

Retired files:

- `src/features/onboarding/__tests__/tutorialUiSource.test.ts`
- `src/features/onboarding/__tests__/overlaySource.test.ts`
- `src/app/__tests__/gameEntry.test.ts`
- `src/app/__tests__/g10AccessibilityTypography.test.ts`
- `src/features/game/__tests__/gameOverOverlaySource.test.ts`
- `src/features/game/__tests__/gameBackground.test.ts`
- `src/app/__tests__/homeDailyMap.test.ts`
- `src/features/themes/__tests__/themeRenderSource.test.ts`
- `src/features/adventure/__tests__/objectivePanelSource.test.ts`
- `src/features/game/__tests__/gameSettingsOverlaySource.test.ts`
- `src/app/__tests__/homeLayout.test.ts`
- `src/app/__tests__/weeklyPrizeUiSource.test.ts`
- `src/app/__tests__/retentionLoopSource.test.ts`
- `src/app/__tests__/g18NotificationEligibilitySource.test.ts`
- `src/app/__tests__/weeklyGoalUiSource.test.ts`
- `src/app/__tests__/adventureWindowSource.test.ts`
- `src/features/monetization/__tests__/interstitialCallsitesSource.test.ts`
- `src/app/__tests__/adventureSettingsOverlaySource.test.ts`
- `src/features/adventure/__tests__/failOverlaySource.test.ts`
- `src/app/__tests__/collectionVisual.test.tsx`
- `src/features/mascot/__tests__/helperControlsDecoupling.test.ts`

Also retired `jewelCollectionFlightSource.test.ts`: it asserted formatting of
coordinate additions; flight queue/arrival behavior remains covered separately.
HUD and Adventure failure checks now exercise bindings/actions. Tower geometry
checks all 96 actual positions rather than old 11-column source literals.

Drag source-string guards were retired after extracting the shared UI worklet.
The existing drag callback suite now checks a stationary preview against a real
board update, without duplicating placement/preview algorithms in the mock.
Native recordings remain the evidence for timing, opacity continuity and JSI.
