# Android low-end performance gate

## Reference device

Use a physical **Samsung Galaxy A12 (SM-A125F), 3 GB RAM, Android 11 or 12** as
the release performance gate. Keep power saving disabled, refresh rate at the
system default, at least 20% free storage, and no screen recorder running.

An emulator is suitable for functional checks only. Its frame pacing is not a
release signal because host CPU/GPU scheduling does not represent this device.

## Build and preparation

1. Test a release-signed or release-like build with developer profiling disabled.
2. Reboot the device, wait two minutes, then cold-start the app three times.
3. Clear app data before the FTUE run. Preserve data for the returning-user run.
4. Disable network only for the explicit offline-start scenario.

## Required scenarios

Run each scenario for at least three minutes after one warm-up pass:

1. First launch: splash to playable tutorial, first drag, invalid drop, first
   valid drop, line-clear celebration, and return to Home.
2. Classic game: continuous fast placements through at least ten line clears,
   including combo effects and game over.
3. Returning Home: resume, next-action card, prompt eligibility, and immediate
   transition back to the board.
4. Adventure: open map, enter a level, clear the objective, and return.
5. Offline start: airplane mode, cold start, and immediate local play.
6. Background recovery: background during a drag, return after 30 seconds, and
   continue without reset or duplicated overlays.

## Pass criteria

- Cold start reaches an interactive board in **2.5 seconds or less** at p95 of
  10 measured launches; no network request may block play.
- Gameplay maintains **at least 50 FPS at p95 frame time** during placement and
  line-clear bursts, with no freeze longer than 200 ms.
- Drag follows the finger without visible sustained lag; touch-to-feedback is
  **100 ms or less** for valid and invalid drops.
- Java/Kotlin crashes, ANRs, blank screens, missing textures, duplicated FTUE,
  and layout clipping are release blockers.
- Memory remains below **350 MB PSS** after ten minutes and does not grow by
  more than 20% between minute five and minute ten.
- Battery temperature must stay below the device's thermal throttling warning;
  rerun a throttled sample after the device cools.

Record build version, Android version, free storage, launch samples, FPS/frame
timeline, peak PSS, defects, and a pass/fail decision in the release ticket.
