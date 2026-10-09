# G15 — Android animation performance and crash diagnostics

## Outcome

The verified idle defect is fixed. `ClearSparkLayer` keeps its 28 pre-mounted
spark slots and UI-thread trajectories, but creates each `useFrameCallback` with
`autostart=false`. A slot activates on `play` and deactivates after natural
completion, eviction/cancellation, app backgrounding and unmount. The only
UI→JS handoff is the one-shot natural-completion stop; there is no per-frame
bridge call and no new renderer. A per-slot generation guard prevents a delayed
completion handoff from stopping a slot that has already been reused.

Automated lifecycle evidence:

- empty mounted pool: **0 active callbacks**;
- a presentation activates the slots it uses;
- after 100 simulated 16 ms ticks: **0 active callbacks**;
- removal and unmount stop outstanding work;
- background cancellation suppresses the old presentation until its id is
  actually removed, so foreground cannot replay a particle tail;
- a deliberately deferred completion stop cannot cancel a reused slot;
- source contract locks `autostart=false`, both `setActive` transitions,
  generation-guarded one-shot completion and the AppState cancellation path.

This proves lifecycle behavior, not an FPS gain. No FPS improvement is claimed.

## Native profiling status

**Not verified.** The only attached Android target is the 60 Hz, API 29 x86_64
emulator `emulator-5554`. No physical low-end or medium Android is available,
and no new release candidate/source-map pair was built for this dirty working
tree. Emulator measurements would not satisfy the requested release profile.

The complete two-device protocol, scenarios, metrics and result table are in
`docs/runbooks/g15-android-animation-profile.md`. It covers idle, normal moves,
multi-clear, 15-minute play, pause/Home/restart, foreground, reduced motion and
ad return; p50/p95/p99 frame time, jank, input latency, CPU, PSS, refresh rate,
thermal state and recording overhead are mandatory.

## AppMetrica crash evidence

Available historical evidence is deliberately kept separate by build:

- 1.1.31 (36), Galaxy M11 / Android 12: one
  `TypeError: Cannot read property 'precision' of undefined` while creating
  `THREE.WebGLRenderer`; that WebGL path was degraded to SVG.
- 1.1.32 (37), Galaxy A57 5G / Android 16: one
  `RetryableMountingLayerException` without an application stack frame; it was
  not speculatively patched.
- A later API 29 emulator reproduction captured Fabric `addViewAt` reparenting
  on Adventure → Settings → Home. The reproduced scenario passed after keeping
  the playfield native parent non-collapsible; this is documented in
  `output/home-crash-verification.md`.

There is no authorized current export containing the full AppMetrica
`JavaScriptException`, Fabric/clipping and `AnimationFrame` stacks with their
breadcrumbs. The archived 1.1.38 (43) AAB and its matching map are documented,
but they do not match the current modified tree. Therefore this report does not
merge group labels into one cause, re-symbolicate with the wrong map, or claim
that a quiet small sample proves a fix.

## Acceptance status

| Gate | Status |
| --- | --- |
| 0 callbacks at idle | PASS — automated lifecycle test |
| restart on a new clear | PASS — automated lifecycle test |
| stop after last/cancel/background/unmount | PASS — automated lifecycle regressions |
| preserve pool and UI-thread trajectory | PASS — same 28 slots and worklet physics |
| physical low-end + medium release profile | **UNVERIFIED — devices/artifact unavailable** |
| full symbolicated AppMetrica triage | **UNVERIFIED — occurrence export unavailable** |

G15 may proceed as a checked code fix with an explicit external device-lab and
crash-export gate. It is not a completed native performance certification.

## Verification

- focused lifecycle/effects: 2 suites, 25 tests passed;
- full frontend: 154 suites, 1014 tests passed;
- backend: 16 tests passed;
- TypeScript: pass;
- Expo lint: pass with the same two pre-existing warnings outside G15;
- device inventory: one 60 Hz API 29 emulator, zero physical devices.
