# G15 Android animation profile

This runbook closes the native half of G15. Run it against the exact release
candidate and attach the matching JavaScript source map. An emulator is only a
functional smoke test and must not be used for the performance verdict.

## Test matrix

Use both devices with battery saver and screen recording disabled:

| Lane | Required device | Record |
| --- | --- | --- |
| Low end | Samsung Galaxy A12 (SM-A125F), 3 GB, Android 11/12 | OS, RAM, free storage, refresh rate, thermal state |
| Medium | A currently supported 6–8 GB physical Android | model, OS, RAM, free storage, refresh rate, thermal state |

Install the same signed release AAB-derived APK set on both devices. Record
`versionName`, `versionCode`, AAB SHA-256, commit, source-map SHA-256 and whether
the profiler/Perfetto capture was active. The map must come from that exact
bundle; never symbolicate a newer working tree with the 1.1.38 map.

## Scenarios

Warm up once, then capture three runs per scenario:

1. 30 seconds idle on a playable board.
2. 30 ordinary placements, including invalid and valid drops.
3. Rapid single- and multi-line clears.
4. 15 minutes continuous play; sample PSS at minutes 0, 5, 10 and 15.
5. Pause → resume, Home → restart, background for 30 seconds → foreground.
6. Repeat the clear path with Android Reduce motion enabled.
7. Return from rewarded/interstitial advertising and play another clear.

For every run capture frame time p50/p95/p99, janky-frame count and percentage,
touch-to-visible-feedback p50/p95, app CPU, PSS, refresh rate, thermal state and
recording overhead. Keep raw Perfetto/System Trace and `dumpsys gfxinfo` files.

The spark-specific acceptance is observable in a Reanimated instrumented build:

- 0 active `ClearSparkLayer` frame callbacks during the 30-second idle sample;
- callbacks restart for every new clear;
- callbacks return to 0 after the last spark, presentation cancellation,
  background/blur and unmount;
- no visible particle tail after leaving the board.

Use the repository-wide thresholds in
`docs/runbooks/android-low-end-performance-gate.md`. Do not turn a debug build,
emulator trace or profiler-inflated sample into the release verdict.

## Crash triage

Export every relevant AppMetrica occurrence, not only the group title:

- `JavaScriptException`, Fabric/clipping and `AnimationFrame` group identifier;
- version/build, device, OS, timestamp, session and occurrence count;
- full native and JavaScript stacks plus breadcrumbs for the preceding actions;
- the exact release source map and its SHA-256.

Symbolicate only with the matching artifact. Cluster by the first symbolicated
application frame and reproduce that action sequence on the same OS class.
Link a code fix only when the before scenario reproduces and the same scenario
passes afterward. A small interval with no new crash is monitoring evidence,
not proof of a fix.

## Result template

| Device/scenario | Hz | Capture overhead | frame ms p50/p95/p99 | jank | input p50/p95 | CPU | PSS | spark idle/end | Verdict |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| Low / idle | | | | | | | | | |
| Low / ordinary | | | | | | | | | |
| Low / multi-clear | | | | | | | | | |
| Low / 15 min | | | | | | | | | |
| Medium / same matrix | | | | | | | | | |

