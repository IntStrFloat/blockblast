# G10 — Android UI, typography and accessibility evidence

## Outcome

G10 passes the visual threshold at **96/100**. Russian functional copy now uses explicit Cyrillic-safe roles, Home actions do not ellipsize, the current Adventure level is revealed on entry, result progression is visible before the next-level action, and Classic/Adventure overlays remove the playfield from the native accessibility tree.

## Device and method

- Android 10 / API 29, x86_64 emulator `emulator-5554`.
- Debug APK built from the working tree and driven with ADB.
- Base display: 1080×1920 px at 420 dpi (about 411 logical dp wide).
- Responsive matrix: 320, 360, 390 and 430 logical dp at font scales 1.0, 1.3 and 1.6.
- Native screenshots and `uiautomator` trees were captured independently of the earlier web evidence.

## Visual evidence

| Surface | Evidence | Result |
| --- | --- | --- |
| Home matrix | `output/g10-native/matrix-home-stable-{320,360,390,430}-f{1.0,1.3,1.6}.png` | Full Russian mode labels and unclipped logo; bottom content scrolls at the 320/160% extreme rather than clipping. |
| Home default | `output/g10-native/home-fixed.png` | Full next-action and weekly-ranking copy; current goal owns flexible space. |
| Game matrix | `output/g10-native/matrix-game-{320,360,390,430}-f{1.0,1.3,1.6}.png` | Safe-area board, objective, tray and 48dp settings action. |
| Pause matrix | `output/g10-native/matrix-pause-valid-{320,360,390,430}-f{1.0,1.3,1.6}.png` | Modal content contained; the 320/160% case keeps every action readable and reachable. |
| Adventure map matrix | `output/g10-native/matrix-map-final-{320,360,390,430}-f{1.0,1.3,1.6}.png` | Current level 2 and its neighbors are revealed; localized title and launch CTA fit at 320/160%. |
| Map persistence | `output/g10-native/adventure-map-manual-saved.png`, `output/g10-native/adventure-map-restored.png` | SHA-256 files are identical after leaving and reopening the map. |
| Adventure result matrix | `output/g10-native/matrix-result-clean-{320,360,390,430}-f{1.0,1.3,1.6}.png` | `+500 XP`, overall level contribution, next level, nearest reward and the next-level CTA remain reachable; stress layouts show a scroll indicator. |

## Native accessibility evidence

- `output/g10-native/pause-fixed3.xml` contains only `Продолжить`, `Звук`, `Вибрация`, `Домой`, and `Заново` while Classic pause is open.
- `output/g10-native/adventure-pause-tree3.xml` contains the same five pause controls and no Adventure objective/settings nodes. The underlying playfield is hidden with `no-hide-descendants`; result/fail use the same boundary and result is additionally modal.
- The Adventure map exposes one summary node (`1/96`), a localized `Назад` button and the explicit `Уровень 1` launch action. Decorative/noninteractive cells are not converted into small buttons.
- GameButton and settings switches expose explicit button/switch roles, disabled/checked state and minimum 48dp targets.

## TalkBack limitation

The test image reports `installedServiceCount=0`; `com.google.android.marvin.talkback` is absent. Its apparent `com.android.vending` package is only the SDK `LicenseChecker` stub, so Android Accessibility Suite cannot be installed through this image. Spoken traversal is therefore **not claimed**. The native accessibility tree and modal focus boundary were verified, and actual spoken TalkBack traversal remains a device-lab follow-up rather than being replaced with a web assertion.

## Verification

- TypeScript: pass.
- Expo lint: pass with two pre-existing warnings (`seasons.ts`, `mascot/logic/types.ts`).
- Focused G10/G06 tests: 5 suites, 19 tests passed.
- Full frontend regression: 146 suites, 982 tests passed.
- Backend regression: 16 tests passed.
- Contrast regression covers Pause CTA, Home quick-link details, result copy and the XP summary card at ≥4.5:1.
- Visual verdict: 96/100, threshold 90, pass.
