# Tray Drag And Line Clear Motion

## Goal

Make tray pieces easier to grab without changing placement coordinates, and make
motion feel tighter in the tray while giving line clears a stronger payoff.

## Interaction Design

- Each piece gets a stationary gesture target covering its entire third of the
  tray and extending 24 px below it.
- The rendered piece stays centered in the original tray slot. Only the visual
  piece moves after the gesture begins; the enlarged target never affects drop
  coordinates.
- Neighboring piece targets never overlap horizontally.

## Tray Motion

- New pieces appear from 90% to 100% of their resting presentation scale in
  about 110 ms instead of growing from zero with a spring.
- Invalid drops return with a short, non-bouncy timing animation. Translation
  settles in about 130 ms and scale in about 100 ms.
- Grab scale remains readable but is reduced from 1.0 to 0.92 to avoid a large
  size jump near the bottom edge.

## Line Clear Motion

- Cleared cells briefly pop above 1.0 scale, then rotate and collapse.
- Stagger is tightened from 18 ms to 10 ms so multi-line clears feel connected.
- Each cleared row or column gets a quick white sweep.
- Particle budget increases from 24 to 36, with three smaller fragments per
  sampled source and a slightly longer ballistic tail.

## Verification

- Unit tests lock activation geometry, tray timing, clear-wave delay, and
  particle source limits.
- Existing game tests, typecheck, and lint remain green.
- Android smoke verifies grabbing below a small piece, invalid-drop return,
  tray refill, and a line-clear visual without crashes.
