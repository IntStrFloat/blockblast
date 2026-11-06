# Night Candy integration

Final local integration, 2026-11-05. Branch `feat/night-candy`, base `7bbb757`.
Changes are intentionally local and uncommitted. The supplied HTMLs are the
visual and interaction authority; `sources.json` preserves their SHA-256 hashes.

The 15 authored screens and their state variants are implemented in native
React Native/Reanimated, connected to durable gameplay and progression.
Review deliverables are in `outputs/blockblast-redesign/delivery` beside the
repository: original references, Android screenshots, actual-input videos,
`index.html` and `validation.json`. APK/AAB are in the repository's ignored
`dist/` directory. These are local builds, not a signed store release.

## Required scope / acceptance evidence

- [x] 01 Splash: candy logo, supplied Capy art, loading treatment; no blank frame.
- [x] 02 First game: three-step indicator, Capy speech, taught square placement,
  two-line clear, skip; no separate welcome gate.
- [x] 03 Home: two stat chips, settings, Capy rank, one Classic card with embedded
  continue, Adventure card, weekly progress, four persistent tabs.
- [x] 04 Capy: editable nickname, rank/XP, horizontal reward path, four wardrobe
  categories and equipped/owned/new/locked states. Existing progress survives.
- [x] 05 Rating: weekly target and prize, podium, player row, offline/pending state.
- [x] 06 Settings: one list, game switches, praise tone, field themes, language,
  reminders, analytics, reset confirmation, privacy.
- [x] 07–09 Game: identical candy blocks, recessed board, 55% tray pieces,
  80ms pickup, 1.5-cell finger offset, colored ghost / line preview,
  coral conflicts with crosses, 200ms return without error text.
- [x] 10 Pause: dismissible bottom sheet, continue, restart with inline second
  confirmation, home, sound/haptics.
- [x] 11 No moves: bottom-up dim wave, same helper sheet in both modes,
  truthful helper availability, guaranteed replacement / hint contracts, then end.
- [x] 12 Result: normal / record variants on the same background; XP reward,
  rank transition, retry/home/share; soft push after first new record only.
- [x] 13 Adventure: tower map, 12-piece chapter picture, selected level card,
  completed/current/locked/chest nodes; all actual levels accessible.
- [x] 14 Adventure level: crystal goal, progress steps, same unified playfield.
- [x] 15 Level complete: picture reveal, earned XP, next/home.
- [x] Shared primitives: exact palette, Nunito 700/800/900 and Unbounded
  700/800/900, icon paths, solid button edge, progress, sheets and tab icons.
- [x] Adventure mechanics / art: crystal cells retain their goal appearance during
  recoloring; the reference stone survives one line and breaks on the second;
  the chapter reveals one of 12 picture parts per level. Preserve old active saves.
- [x] Motion: placement squash/ring, pulsing colored preview with sheen,
  center-out 45ms/cell clear wave/colored fragments, combo/score flight,
  invalid shake/return, low-space border, no-moves wave, record/confetti,
  item flip/unread badge. Honor sound, haptics and reduced-motion settings.
- [x] Source review: compare all screens against HTML at the same viewport and
  equivalent real state; record remaining differences explicitly.
- [x] Runtime: standalone ARM64 APK on the already assigned AVD, real drag/clear,
  navigation and helpers, frame timing captured during gameplay without concurrent
  builds, no empty handoff frame or visual state discontinuity in sampled video.
- [x] Checks: typecheck/lint, relevant behavioral tests, regression suite; no
  mock test or screenshot inventory substitutes for runtime visual review.

## Durable implementation decisions

- Keep the engine, run envelopes, reward receipts, leaderboard proof and existing
  applicationId authoritative. Never substitute prototype scores, nicknames,
  entitlements or a fake weekly reward contract. Existing six-color Classic
  generation and active saves remain compatible; render all seven palette IDs.
- Use one shared Night Candy token set, radial background, buttons, progress,
  sheets, tab rail and candy block material. Nunito 700/800/900 and Unbounded
  700/800/900 are bundled offline with Cyrillic support. Original Capy PNG copied
  unchanged; SVG skin filters preserve that raster. Adventure adds the supplied
  orange bottom radial. Android SVG stop offsets use `0.7`, not `.7`.
- Design baseline: 390×844 dp. Shorter Android screens scroll or adapt playfield
  geometry; native safe-area insets replace device-specific prototype gaps.
- Drag, preview, landing and clear run on UI shared values. A pre-mounted landing
  owner keeps the piece opaque until the board/clear layer acknowledges native
  layout. Release of the next held piece can queue during the previous landing;
  it is accepted once the owner is free. No per-frame React state or repeated
  layout measurement is used for normal drag. Stationary previews refresh through
  the same bounded worklet when lift, board revision or measured origin changes.
- Motion: 80ms pickup, 140ms snap/squash/ring, 200ms invalid return with coral
  conflicts, 420ms clear with 45ms/cell wave capped at 240ms, 650ms combo/score,
  1200ms record/new-item effects. Bounded effect pools stay mounted. FTUE→Classic
  interpolates layout for 280ms, then introduces helpers; teaching piece is 75%,
  normal tray pieces 55%. Sound, haptics and reduced motion are respected.
- Gameplay banners request the SDK's inline size capped to the same 50dp as the
  reserved dock. Home keeps sticky sizing. Late ad load/hide/recovery must not
  change board geometry or clip a creative.
- NoMoves is shared by both modes. Hint removes the last real footprint and
  returns the original shape; Swap supplies three individually legal pieces or
  remains unavailable when none can fit. Display actual daily+owned charges and
  rank/SDK availability. Persist the rescued run and spend intent before debit;
  balance and debit receipt are atomic and recovery is idempotent at both crash
  boundaries. Explicit End acknowledges the result before result presentation.
- Adventure uses crystal goals for new rulesVersion 2 runs, preserves old active
  objectives and failure history, and serializes two-hit stones. The first hit
  leaves an occupied one-hit stone and cannot earn a false board-clear bonus.
  Defer the final crystal counter until the keyed arrival effect. Keep authored
  first-21 map coordinates and all 96 real levels accessible. Pause already
  obtains two inline restart taps; never add a third modal confirmation.
- Classic activity and its hardware-back listener follow screen focus; activity
  also follows pause and foreground, scoped to runId;
  cleanup from an older screen cannot pause a newer run. Capy round trips retain
  the run. First new-record push uses a soft permission prompt before OS access.
- Unread items persist until first wear, including after unequip. Back-mounted
  cosmetics and auras stay behind Capy; front accessories remain in front.
- Reuse permanent AVD `Cocos_Game_Lab_API35` / `emulator-5580`. Native fixtures
  used a separate temporary applicationId on this SAME AVD. It was removed after
  capture; no AVD clone, wipe, old snapshot restore or production-data reset.

## Final validation

- Typecheck passes. Lint: zero errors, one pre-existing `seasons.ts` array-syntax
  warning. Jest: 174 suites / 1202 tests pass. Backend: 16 pass. The final full run includes the native-found focus/back fix and SVG stop
  spelling fix; typecheck/lint were rerun. See validation.json for artifact hashes and source
  fingerprint. Obsolete source-pattern assertions were retired with rationale
  in `test-migration.md`; real store, engine and callback regressions remain.
- Standalone ARM64 production APK built and installed with `-r`; no Metro.
  Unsigned AAB built with all four supported ABIs. Package stays
  `com.intstrfloat.blockblast`, version 1.1.46, versionCode 51. Local APK uses
  Android Debug identity; AAB intentionally has no release signature.
- Native review covered Home, Settings, Capy/skin, nickname, offline/ready Rating,
  map, Classic, FTUE, Pause, NoMoves, normal/record results, Adventure and result.
  Actual inputs verified tutorial double clear, replacement/hint debit, queued
  rapid release, triple clear, combo ×2, two-tap Adventure restart, first stone
  hit and a real Adventure win 11→12 with a +500 XP receipt. Final main-package
  recording verifies accepted and invalid drag after a Capy/back round trip.
- Equivalent viewport captures use 780×1688 px at density320 (390×844 dp).
  Restored physical 1080×1920 before final main-package checks. Main progress
  best3352/rank2 was preserved; the final legitimate placement adds five points
  to the saved Classic run (1315→1320), and invalid placement keeps its piece.
- Frame timings are sampled on this AVD without a concurrent build/test. See
  validation.json and gameplay-final.mp4. Recorded absence of a handoff gap in
  sampled frames is evidence for those interactions, not a universal guarantee
  on every Android device or under every scheduling condition.

## Explicit source limitations / differences

- Native Android status inset moves ordinary top content approximately 5dp
  relative to the device-specific static reference. Dynamic names, scores,
  unlocked items, rewards and board contents follow real state.
- Source supplies only the visible chapter-picture 4/12 state. That visible
  pixel pattern is copied; hidden completion pixels use an inferred fur palette.
  Extra wardrobe silhouettes without supplied art are adaptations. Do not call
  them identical source artwork or claim universal pixel identity.
- Videos labeled with an earlier build number verify their named mechanism.
  Final videos use the final gameplay code; the subsequent SVG spelling fix
  affects the Adventure background only and was checked natively in build20.
- Local service configuration still intentionally omits unavailable production
  AppMetrica/Huawei credentials; real network leaderboard/ad/notification behavior
  depends on service availability and production configuration. No credentials
  were fabricated. Store upload requires the existing release key separately.

## User follow-up: Adventure, placement readability, live record HUD

These explicit follow-up changes take precedence over the static HTML prototype.

- Personal Adventure progress already advances on wins, independently of the
  server's 14-day visual window. Keep that contract and existing saves. Removed
  unused calendar refreshes from Home/map/level; the compatible calendar API and
  stored fields remain. `seasonId` is the legacy name for an earned 96-level
  campaign block. Global level and chapter numbers continue after level96;
  chapters contain12 levels. Map shows the current level, explains win-to-unlock,
  and offers Continue only for a matching active saved level.
- The widest staggered map row extended to394px while being scaled as358px.
  Fitting a400px design canvas into the viewport keeps all96 nodes inside, without
  translating the entire map to fit just its active node. Active Capy draws above
  neighboring nodes. Scroll layout version7 invalidates only old offsets; it does
  not reset game progress. A long Continue CTA stacks on narrow screens.
- Board publication, retirement of the preceding preview, native landing release
  and board revision now run in one UI transaction from the layout effect. The
  old passive synchronization could expose a stale footprint over the new board.
  Preserve preview ownership when the next piece is actually held.
- A line preview outlines existing blocks instead of repainting them into the
  dragged color. Frame-zero clear covers keep each removed cell's actual color;
  the white clear wave remains. This deliberately replaces the prototype's
  opaque monochrome line wash to keep board contents readable.
- Removed the legacy live-record gradient rectangle and oval ring. Keep bounded
  gold confetti, score pulse, record sound and full result-screen celebration.
- Three focused regressions cover map bounds, the atomic handoff boundary and
  preserving an occupied block's color during line preview. Full checkpoint:
  174 suites /1205 tests, backend16, typecheck pass; lint has the existing seasons
  array-syntax warning only. Native recording uses separate fixture storage on
  the same permanent AVD; the main3568-point run and rank3 must be preserved.
- Follow-up screenshots, video, current package hashes and native timing limits
  are in the sibling `outputs/blockblast-fixes/` folder. Earlier redesign review
  remains a historical checkpoint, including its original artifact hashes.

Native capture hygiene: Expo prebuild can retain an added URI scheme when a
temporary review config is removed. Remove `blockblast-review` from the ignored
generated MainActivity manifest before the main build, then inspect both final
APK/AAB manifests as well as their Hermes bundles. The isolated capture helper
now removes its temporary scheme in its cleanup path.

## User follow-up: make the hint unmistakable

- Normal hints and NoMoves rescues share `helperHint` presentation. Normal hints
  publish it only after a successful helper debit, using the current board/tray;
  they no longer overwrite the finger-owned preview or disappear after1.9s.
- Classic's existing44dp helper rail shows a Capy acknowledgement and a dismiss
  control until a move or dismissal. With the companion disabled it uses a bulb.
  Adventure reuses its existing instruction pill. No board/tray/ad resize.
- Gold dashed targets, a bounded white pointer and a gold outline around the
  actual recommended tray piece connect the instruction with the move. Each
  visible layer uses one UI clock; reduced motion is static. A delayed tray item
  is highlighted only if it is still the store's actual recommended piece.
- All guidance yields during a drag/landing, returns after a rejected move and
  clears after an accepted move. Pointer layers never capture gestures. Existing
  occupied cells retain their colors even when the hint previews a line clear.
- Native Classic validation: rescue charge3→2, dismiss, normal hint2→1, invalid
  drag/return(score1240), then the advised H3 placement and clear(score1413).
  Guidance disappears and the remaining hint charge stays1. Adventure guidance
  was also checked. Fixture storage is separate on the same assigned AVD.
- 174 suites /1206 tests plus16 backend tests pass; typecheck/lint checked. The
  stale exact-string assertion in helpPreviewSource is replaced by actual
  BoardCell animated-style coverage for finger ownership and restoration.
- Review screenshots/video and current binaries are in the sibling
  `outputs/blockblast-hint-guidance/`. Isolated captures use demo ad units;
  main APK/AAB keep production IDs and contain no temporary review route/scheme.

## Warm wood SFX / clear-effect follow-up (2026-11-05)

- User chose soft wood and warm melodic tails. `scripts/gen-sounds.js` now
  reproducibly generates18 logical cues /32 original PCM WAVs and their native
  manifest. No third-party recordings. Frequent Android cues alternate samples;
  every file ends with40ms fading and12ms silence. Maximum sample1.425s.
- Accepted placement and invalid return have distinct timbres. Adventure adds
  one stone accent and one collection/outcome accent per move; victory replaces
  the final jewel accent. Particle sound is part of the clear texture, never a
  separate sound for each visual fragment. Helpers have success cues.
- Android retains predecoded SoundPool playback. Active streams expire by full
  sample duration +24ms; overload skips a new request instead of stealing a tail.
  Inputs waiting for preload longer than250ms are discarded. Background stops
  existing streams without replaying them on resume.
- Removed the continuous row/column wash renderer, landing's expanding white
  border, and placement's central flash square. Per-cell clear covers, landing
  cells, board receipt transaction and small colored fragments remain.
- 174 suites /1209 tests and16 backend checks pass; typecheck/lint checked.
  Same assigned AVD, isolated QA package with demo ads: identical before/after
  three-move recordings, actual two-hit stone damage, Adventure victory, and
  a recorded18-cue audition followed by rapid inputs. Recorded output exists in
  all18 cue windows. Waveform QA checks all32 endings and digital clipping;
  timbral preference still benefits from listening on real phone speakers.
- Review, audio/event audit, native videos, samples and current binaries:
  sibling `outputs/blockblast-sfx-review/`. Main APK/AAB retain production ads;
  temporary audition route/scheme/package are excluded from main artifacts.

## SFX selection checkpoint (2026-11-05, after user listening)

The warm-wood procedural32-WAV bank above was explicitly rejected by the user;
its technical validation is not artistic acceptance. Three initial Kenney
families and three Dustyroom triples were also rejected. The first Kenney
round's C and the first Dustyroom triple were only relative preferences, not
permission to use their assets. Budget is0; paid packs and watermarked trials
are excluded. Reference: original Block Blast! by Hungry Studio.

A new core-only recorded-source prototype uses CC0 VCSL woodblock and marimba
recordings. It is built/installed only as the separate designreview package on
the same registered emulator.22 actual gestures and9 clear moves were recorded;
production audio sources/config/APK were restored exactly. The native capture
is very quiet; its listening copy adds30dB with video frames stream-copied.
The raw recording is retained. Human acceptance is pending. Secondary cues in
this trial are intentionally silent; the full replacement is not complete.

Review and evidence: sibling `outputs/blockblast-sfx-prototype/`. Decisions and
implementation plan: sibling `outputs/blockblast-sfx-research/decision.json`
and `implementation-plan.txt`. Continue from the user's listening feedback;
do not regenerate or ship the rejected bank as an accepted final sound design.
