# Block Blast Spectacle Motion Design

## Status

Approved visual direction: **C. Maximum spectacle**.

This document converts that direction into precise production behavior for
Bloxx. It also covers the web background defect and removal of the technical
`Live backend` label from the player-facing home card.

## Research Basis

### Current Original

- Product: Block Blast by Hungry Studio.
- Current App Store version during research: `7.1.6`.
- Release date: June 11, 2026.
- Primary source:
  <https://apps.apple.com/us/app/block-blast/id1617391485>
- Additional evidence: the two gameplay captures supplied by the user and the
  seven current App Store screenshots.

### Observed Motion Language

The current official screenshots and supplied captures consistently show these
states:

1. A completed row or column is held briefly instead of disappearing
   immediately.
2. Completed cells receive a sharp light contour plus a larger colored halo.
3. Multiple completed axes create additive color at their intersection.
4. Blocks lose mass through small square debris rather than only fading.
5. A luminous trail remains on the cleared axis for a short period.
6. Strong clears and combos add large praise typography and a local score burst.
7. The effect color follows the cleared blocks, but the brightest contour is
   close to white for legibility.

The screenshots are static. Exact original timings are therefore not directly
measurable from the source material. The timing values below are a design
inference that reproduces the visible cause-and-effect order without claiming
to be extracted from proprietary runtime code.

## Goals

- Reproduce the high-impact choreography of the current Block Blast effects
  while retaining Bloxx colors, typography, and original assets.
- Keep every line contour pixel-aligned with the board geometry.
- Make a clear readable before it becomes spectacular.
- Support simultaneous rows and columns, including a clean cross intersection.
- Keep drag input and the next move responsive while effects are running.
- Remove white web gutters or flashes during initial hydration.
- Remove infrastructure language from the weekly leaderboard card.

## Non-Goals

- Do not copy Block Blast textures, fonts, sounds, particle sprites, or artwork.
- Do not change scoring, placement rules, board state, or leaderboard logic.
- Do not add a new rendering dependency.
- Do not delay board-state updates until animations finish.
- Do not show a large praise badge for an ordinary placement without a clear.

## Motion Choreography

All timings are relative to the accepted drop at `t=0`.

### Phase 1: Placement Impact, 0-90 ms

- Newly placed cells settle from scale `1.10` to `1.00`.
- The board receives a `1 px` inward light pulse under the placed shape.
- No shake occurs yet.
- If no line is completed, the sequence ends here.

### Phase 2: Completed-Line Lock, 35-165 ms

- Every completed row and column receives a crisp inner contour.
- The contour is built from cell-aligned segments, not a freehand rectangle.
- Each occupied segment uses:
  - inner white stroke: `max(1, round(cell * 0.035))`;
  - chromatic stroke: `max(2, round(cell * 0.065))`;
  - corner radius: the existing block radius;
  - inset: `1 px` from the block edge.
- A line-wide underglow expands by `4%` along the clearing axis.
- Glow color is sampled from the cleared cells. Mixed-color lines interpolate
  through up to four representative colors.
- Opacity rises to `1.0` by `90 ms`, holds through `130 ms`, and starts fading
  as destruction begins.

### Phase 3: Intersection Flare, 90-205 ms

- For each row/column intersection, render one centered flare.
- Diameter: `0.72 * cell`.
- Core: white at `0.88` peak opacity.
- Middle layer: active line gradient at `0.64` opacity.
- Outer layer: `1.45 * cell`, maximum opacity `0.28`.
- The flare scales `0.55 -> 1.20 -> 0.90` and never exceeds the board bounds.
- Intersections do not stack duplicate flares.

### Phase 4: Block Crush, 145-335 ms

- Each cleared block first compresses to:
  - `0.82` perpendicular to the cleared axis;
  - `1.04` along the cleared axis.
- At `185 ms`, the visual block splits into four clipped quadrants.
- Quadrants preserve the original block base, top highlight, and bottom shade.
- Each quadrant travels `0.16-0.34 * cell` away from its center.
- Rotation is limited to `-18..18 deg`.
- Final fragment scale is `0.30-0.42`.
- Opacity remains above `0.75` until the silhouette has visibly separated,
  then reaches zero by `335 ms`.
- Cells belonging to both a cleared row and column use radial separation rather
  than choosing one axis.

### Phase 5: Axis Trail And Debris, 175-475 ms

- A luminous trail remains behind the crushed blocks.
- Horizontal trail height: `0.34 * cell`.
- Vertical trail width: `0.34 * cell`.
- Trail length is exactly the board span occupied by the completed axis.
- The trail uses a transparent-color-white-color-transparent gradient.
- It peaks at `235 ms` and fades by `390 ms`.
- Small square debris:
  - `4` fragments per sampled cleared cell;
  - maximum `56` fragments total;
  - size `0.08-0.17 * cell`;
  - travel `0.45-1.35 * cell`;
  - direction biased along the clearing axis;
  - lifetime `260-430 ms`.
- Six optional white spark pixels may be added at intersections and line ends.

### Phase 6: Shake, 175-360 ms

- One line: no global board shake; only a `1.5 px` impact nudge.
- Two lines: `3 px` damped shake.
- Three lines: `4 px` damped shake plus a `1.01` board scale pulse.
- Four or more lines or a full-board clear: `5 px` damped shake plus a
  `1.015` scale pulse.
- The sequence has no more than four direction changes.
- The board returns exactly to transform identity.
- The tray, HUD, and safe-area layout do not shake.

### Phase 7: Praise And Score Burst, 255-820 ms

- Praise starts after the line geometry has become readable.
- Typography uses the existing Unbounded family, not copied artwork.
- Text is constructed from layered copies:
  - dark navy extrusion at `2 px` down;
  - warm gold or event-color body;
  - white highlight at `1 px` up;
  - chromatic outer glow at low opacity.
- Entry: scale `0.68 -> 1.12 -> 1.00`.
- Hold: `180-260 ms` depending on tier.
- Exit: translate `-18 px`, scale `1.04`, opacity `0`.
- Size is bounded by the board:
  - `good`: `0.075 * boardSize`;
  - `great`: `0.085 * boardSize`;
  - `amazing`: `0.095 * boardSize`;
  - `unbelievable`: `0.105 * boardSize`;
  - hard maximum: `38 px` on phones.
- `Combo N` appears as a second line only for combo `>=2`.
- A local `+scoreDelta` burst appears near the cleared-line centroid and moves
  toward the HUD score. It must not cover the tray.

## Exact Geometry Rules

### Coordinate Source

All effect geometry is derived from:

```ts
step = cell + gap
x = col * step
y = row * step
```

No magic board coordinates are allowed in effect components.

### Contour Segmentation

- A row contour contains exactly eight cell segments.
- A column contour contains exactly eight cell segments.
- Every segment width and height equals `cell`.
- Segment position equals the underlying board cell position.
- The contour follows each block corner rather than drawing through the gap.
- A translucent line-wide band may sit behind segments, but it cannot replace
  the crisp segmented contour.
- When a row and column cross, the shared cell is rendered once in the crush
  layer and once in the contour layer.

### Clipping

- Crisp contours are clipped to the board.
- Outer bloom may extend no more than `0.14 * cell` inside the board boundary.
- No glow, shard, or praise element may create layout overflow on web.
- Effects use absolute positioning and transform/opacity only.

## Component Design

### `clearPresentation.ts`

Pure functions convert a placement event and board geometry into:

- line segments;
- line gradients;
- intersections;
- crush fragments;
- debris particles;
- praise sizing;
- shake intensity.

Random-looking fragments use a deterministic seed from the placement event so
tests and replays remain visually stable.

### `LineHighlightLayer.tsx`

Renders:

- crisp segmented contours;
- chromatic underglow;
- row/column trails;
- intersection flares.

It has no knowledge of scoring or store mutation.

### `BlockCrushLayer.tsx`

Renders four clipped quadrants for each cleared block. It receives immutable
presentation data and performs only Reanimated entry animations.

### `ClearDebrisLayer.tsx`

Replaces the current generic particle burst with deterministic, axis-aware
square fragments and limited white sparks.

### `PraiseBanner.tsx`

Keeps the existing praise text source, but replaces the plain text animation
with the layered spectacle treatment and score burst. It remains
`pointerEvents="none"`.

### `useShake.ts`

Accepts a severity rather than a boolean trigger and returns both translation
and scale transforms.

## Performance And Accessibility

- Maximum simultaneous animated views:
  - contour segments: `16` for a common row+column clear;
  - crush quadrants: `4 * clearedCellCount`, capped by visible cleared cells;
  - debris: `56`;
  - flares: unique intersections only;
  - praise copies: maximum `4`.
- No effect writes React state per animation frame.
- No layout property is animated.
- Drag gestures remain enabled throughout the sequence.
- A reduced-motion mode uses:
  - one `160 ms` contour pulse;
  - block fade to `0` without quadrant travel;
  - no shake;
  - maximum `12` debris fragments;
  - praise fade/scale without translation.
- Effects must remain readable for classic and Y2K themes.

## Web Corrections

### White Background

The generated Expo HTML currently sets height and margin but does not set a
background color on `html`, `body`, and `#root`. During hydration and outside
the app's constrained content area, the browser default white is exposed.

Add an Expo Router HTML document override that sets:

```css
html,
body,
#root {
  min-height: 100%;
  background: #0f1b33;
}

body {
  margin: 0;
  overflow: hidden;
}
```

The root React layout also keeps an opaque `colors.bgBottom` fallback beneath
the gradient.

### Leaderboard Card Language

- Remove `Live backend` / `Живой backend`.
- When remote data is current, show no technical status.
- When degraded, show only player-meaningful states:
  - `Offline` / `Офлайн`;
  - `Saved results` / `Сохранённые результаты`.
- The detailed leaderboard screen may explain that cached results can be stale,
  but must not mention backend implementation.

## Testing

### Pure Unit Tests

- line segments align to exact cell geometry;
- row+column intersections are deduplicated;
- mixed line colors produce bounded gradient stops;
- crush fragments remain inside configured travel limits;
- debris count never exceeds `56`;
- shake severity maps correctly to line count;
- praise font size respects board and phone caps;
- reduced-motion presentation disables travel and shake.

### Component Tests

- current remote weekly card renders no technical status;
- offline and cached states render player-facing language;
- praise does not render for `none`;
- combo line appears only for combo `>=2`.

### Visual Verification

- Android phone: one row, one column, cross, two rows, three lines, full clear.
- Web portrait: no white background before or after hydration.
- Web desktop: no white gutters around the centered app.
- Classic and Y2K block themes.
- Reduced-motion mode.
- Capture frames at approximately `100`, `200`, `320`, and `600 ms` to verify
  contour alignment and visual hierarchy.

## Acceptance Criteria

- The browser never exposes white outside or behind the app.
- The home card never says `backend`.
- Completed lines visibly lock with a crisp, cell-aligned chromatic contour
  before destruction.
- Every destroyed block keeps its exact silhouette until the four quadrants
  separate.
- Cross clears have one centered flare and no duplicated intersection block.
- Shake intensity reflects clear strength and returns to identity.
- Praise is large and spectacular but never exceeds the board width or covers
  the tray.
- All effects run without changing game rules, drop coordinates, or score.
- Frontend tests, typecheck, lint, Android smoke, and web smoke pass.
