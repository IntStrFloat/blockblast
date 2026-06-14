# Arcade-Balanced Game Feel Design

## Goal

Make every placement feel satisfying and make clears, combos, and a new personal record
feel progressively more celebratory, while preserving board readability and mobile
performance.

The selected visual direction is **Arcade balanced** with a **Soft sunset** game-screen
background.

## Scope

This pass adds:

- placement particles at newly placed cells;
- a stronger, combo-scaled board shake and animated frame pulse;
- clear fragments and debris that continue falling below the board;
- an in-game new-record celebration that fires once per run;
- a score counter that grows in steps as the score rises and pulses on each award;
- a restrained, colorful game-screen background;
- reduced-motion alternatives for every new effect.

The engine scoring rules, placement rules, tray generation, navigation, and non-game
screens remain unchanged. No dependency is added.

## Visual Rhythm

### Ordinary placement

An accepted piece lands with the existing cell spring. Six to twelve small particles,
colored from the placed piece, emit from the newly placed cells and fade quickly. The
score counter performs a short scale pulse.

### Clear

The sequence is:

1. completed lines lock and flash;
2. blocks crush into fragments;
3. debris starts with a small outward impulse, then accelerates downward;
4. fragments and debris may travel below the board and fade outside the game area;
5. praise and score-delta text complete the beat.

The grid remains clipped inside its rounded board container. Clear fragments and debris
render in an external effects layer with visible overflow.

### Combo

- Combo 2 shows the large combo/praise treatment and a restrained frame pulse.
- Combo 3 and above adds a short board shake and a brighter frame pulse.
- Higher combos and multi-line clears increase intensity only within capped limits.
- The game-screen background receives a short, low-opacity color pulse; it never flashes
  to white or competes with the board.

### New record

The first move in a run that raises the current score above the best score captured at
run start triggers one celebration:

- a gold score pulse;
- a short "New record!" banner;
- restrained gold confetti;
- the existing record sound;
- a persistent gold score treatment for the rest of the run.

Later score increases during the same run do not replay the celebration. Loading a saved
run does not replay an already-earned celebration.

### Score progression

The score counter uses stable HUD space and the following capped scale tiers:

- below 1,000: `1.00`;
- 1,000–4,999: `1.10`;
- 5,000–9,999: `1.18`;
- 10,000 and above: `1.25`.

Every score increase triggers a short spring-like pulse. Large awards may add a brief
color shimmer without changing layout.

## Background

Only the game screen uses the **Soft sunset** treatment:

- a dark indigo base;
- muted peach and pink radial glows;
- a cooler indigo glow near the lower area;
- a subtle cool halo behind the board.

The glows are static during normal play. A combo may briefly raise their opacity. Menus
and other screens retain the current app background.

## Architecture

`PlacementEvent` remains the authoritative result of a move. Presentation builders derive
deterministic visual data from the event, geometry, colors, and reduced-motion setting.

The existing clear presentation is extended rather than replaced:

- placement-particle presentation is derived for every accepted placement;
- clear debris gains downward final travel suitable for rendering outside the board;
- combo frame intensity is derived from line count, combo, and board-clear state.

`BoardView` is split visually into:

- an inner clipped board that renders cells and line highlights;
- an outer effects layer with visible overflow for fragments, debris, sparks, placement
  particles, and the animated frame.

The game store captures the best score at run start and stores presentation-only record
state for the active run. This state is not part of the engine and does not affect proof
or scoring. The HUD reads score, last placement event, and active-run record state.

The game screen owns the soft-sunset background and its combo pulse because it sits
outside the board and HUD.

## Performance Constraints

- New animations use Reanimated and animate only `transform` and `opacity`.
- Particle counts are capped and deterministic.
- Existing clear-presentation memoization remains the source for clear effects.
- No continuous background animation runs during ordinary play.
- No new dependency is introduced.

## Reduced Motion

With reduced motion enabled:

- placement particles become a short local fade/glow;
- falling debris and screen shake are disabled;
- frame and background pulses use restrained opacity fades;
- score and record celebrations use short scale/fade transitions without travel.

The information hierarchy and record state remain visible.

## Verification

Unit coverage must prove:

- score scale tier boundaries;
- one record celebration per run and no replay after loading;
- deterministic, capped placement particles;
- combo-frame intensity scaling and reduced-motion behavior;
- clear debris finishes below the board in normal motion;
- reduced motion removes falling trajectories and shake.

Regression verification includes the existing game/store/presentation tests, full Jest,
TypeScript typecheck, and Expo lint. Visual verification covers ordinary placement, a
single clear, combo 3+, first record crossing, persistent gold score, soft-sunset
background, and reduced motion.

## Remaining Risk

Very large clear events can still create many fragment views. Existing caps and device
verification must be used to ensure the expanded external effects layer remains smooth on
mid-range Android hardware.
