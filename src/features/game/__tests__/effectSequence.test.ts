import type { PlacementEvent } from '@/core/engine';

import { budgetClearPresentations } from '../animation/clearPresentation';
import {
  buildEffectSequence,
  countEffectSequenceNodes,
  EFFECT_NODE_BUDGET,
  EFFECT_SEQUENCE_TIMING,
  effectStageStartMs,
  effectSequenceTierFor,
  highComboAuraIntensity,
} from '../animation/effectSequence';
import { SPECTACLE_MOTION } from '../animation/motion';
import { trayRefillDelayMs } from '../animation/useDelayedTray';

const GEOM = { boardSize: 360, cell: 42.75, gap: 3 };
const COLORS = ['#46D7FF', '#FFCE3D', '#FF6A83'];

function event(overrides: Partial<PlacementEvent> = {}): PlacementEvent {
  return {
    placed: [[3, 3]],
    colorId: 1,
    clearedRows: [3],
    clearedCols: [],
    clearedCells: Array.from({ length: 8 }, (_, col) => [3, col] as const),
    clearedColors: Array.from({ length: 8 }, () => 1),
    scoreDelta: 100,
    score: 100,
    combo: 1,
    praise: 'good',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
    ...overrides,
  };
}

describe('effect sequence choreography', () => {
  it('keeps line confetti small and short-lived as it travels outward', () => {
    const sequence = buildEffectSequence(event({ clearedCols: [3], combo: 10 }), GEOM, COLORS, false);
    expect(sequence).not.toHaveProperty('impact');
    for (const mote of sequence.motes) {
      expect(Math.hypot(mote.dx, mote.dy)).toBeLessThan(GEOM.cell * 1.6);
      expect(mote.size).toBeLessThanOrEqual(GEOM.cell * 0.18);
      expect(mote.delayMs + mote.durationMs).toBeLessThanOrEqual(340);
    }
  });

  it('keeps the six visible stages ordered and overlapping intentionally', () => {
    const sequence = buildEffectSequence(event(), GEOM, COLORS, false);

    expect(sequence.stages.map((stage) => stage.stage)).toEqual([
      'lock',
      'charge',
      'impact',
      'wave',
      'celebration',
      'afterglow',
    ]);
    expect(EFFECT_SEQUENCE_TIMING.lockEndMs).toBeLessThanOrEqual(
      EFFECT_SEQUENCE_TIMING.chargeEndMs,
    );
    expect(EFFECT_SEQUENCE_TIMING.impactStartMs).toBeLessThan(
      EFFECT_SEQUENCE_TIMING.waveEndMs,
    );
    expect(EFFECT_SEQUENCE_TIMING.afterglowEndMs).toBeGreaterThan(
      EFFECT_SEQUENCE_TIMING.celebrationEndMs,
    );
    expect(effectStageStartMs(sequence, 'impact')).toBe(
      EFFECT_SEQUENCE_TIMING.impactStartMs,
    );
  });

  it('uses the same absolute anchors as the clear spectacle timeline', () => {
    expect(EFFECT_SEQUENCE_TIMING.lockStartMs).toBe(SPECTACLE_MOTION.lineLockStartMs);
    expect(EFFECT_SEQUENCE_TIMING.lockEndMs).toBe(SPECTACLE_MOTION.lineLockEndMs);
    expect(EFFECT_SEQUENCE_TIMING.impactStartMs).toBe(SPECTACLE_MOTION.flareStartMs);
    expect(EFFECT_SEQUENCE_TIMING.impactEndMs).toBe(SPECTACLE_MOTION.flareEndMs);
    expect(EFFECT_SEQUENCE_TIMING.waveStartMs).toBe(SPECTACLE_MOTION.debrisStartMs);
    expect(EFFECT_SEQUENCE_TIMING.waveEndMs).toBe(SPECTACLE_MOTION.debrisEndMs);
    expect(EFFECT_SEQUENCE_TIMING.celebrationStartMs).toBe(SPECTACLE_MOTION.praiseStartMs);
    expect(EFFECT_SEQUENCE_TIMING.celebrationEndMs).toBe(SPECTACLE_MOTION.praiseEndMs);
  });

  it('maps line, combo, and board-clear events to discrete spectacle tiers', () => {
    expect(effectSequenceTierFor(event())).toBe('line_1');
    expect(
      effectSequenceTierFor(event({ clearedRows: [2, 3] })),
    ).toBe('line_2');
    expect(
      effectSequenceTierFor(event({ clearedRows: [1, 2, 3] })),
    ).toBe('line_3_plus');
    expect(effectSequenceTierFor(event({ combo: 3 }))).toBe('combo_2_4');
    expect(effectSequenceTierFor(event({ combo: 7 }))).toBe('combo_5_9');
    expect(effectSequenceTierFor(event({ combo: 10 }))).toBe('combo_10_plus');
    expect(effectSequenceTierFor(event({ boardCleared: true }))).toBe('board_clear');
  });

  it('creates axis-aligned beams and crisp directional motes without exceeding its slice', () => {
    const cross = event({
      clearedRows: [3, 4],
      clearedCols: [2, 5],
      combo: 10,
    });
    const sequence = buildEffectSequence(cross, GEOM, COLORS, false);

    expect(sequence.beams).toHaveLength(4);
    expect(sequence.beams.map((beam) => beam.axis)).toEqual([
      'row',
      'row',
      'col',
      'col',
    ]);
    expect(sequence.motes).toHaveLength(8);
    expect(sequence).not.toHaveProperty('impact');
    expect(countEffectSequenceNodes(sequence)).toBeLessThanOrEqual(
      EFFECT_NODE_BUDGET.clearAndPlacement,
    );
    expect(
      EFFECT_NODE_BUDGET.comboCelebrationMax + EFFECT_NODE_BUDGET.persistentAuraMax,
    ).toBeLessThan(EFFECT_NODE_BUDGET.total);
  });

  it('keeps each colored wash inside its cleared row or column', () => {
    const sequence = buildEffectSequence(event({ clearedCols: [2] }), GEOM, COLORS, false);
    const step = GEOM.cell + GEOM.gap;
    const row = sequence.beams.find((beam) => beam.axis === 'row')!;
    const col = sequence.beams.find((beam) => beam.axis === 'col')!;
    expect(row.y).toBeGreaterThanOrEqual(3 * step);
    expect(row.y + row.height).toBeLessThanOrEqual(3 * step + GEOM.cell);
    expect(col.x).toBeGreaterThanOrEqual(2 * step);
    expect(col.x + col.width).toBeLessThanOrEqual(2 * step + GEOM.cell);
  });

  it('removes travel motes and persistent aura movement under reduced motion', () => {
    const sequence = buildEffectSequence(event({ combo: 10 }), GEOM, COLORS, true);
    expect(sequence.motes).toEqual([]);
    expect(sequence.reducedMotion).toBe(true);
  });

  it('keeps high-combo aura persistent only for combo five and above', () => {
    expect(highComboAuraIntensity(4)).toBe(0);
    expect(highComboAuraIntensity(5)).toBeGreaterThan(0);
    expect(highComboAuraIntensity(9)).toBeLessThan(1);
    expect(highComboAuraIntensity(10)).toBe(1);
  });

  it('keeps the next tray interactive while the decorative wave finishes', () => {
    expect(trayRefillDelayMs(event())).toBe(0);
    expect(trayRefillDelayMs(event({ newTray: true }))).toBe(0);
    expect(
      trayRefillDelayMs(
        event({
          newTray: true,
          clearedRows: [],
          clearedCells: [],
          clearedColors: [],
        }),
      ),
    ).toBe(0);
  });

  it('drops older overlap before the clear-and-placement budget is exceeded', () => {
    const makePresentation = (id: string, nodes: number) =>
      ({
        id,
        presentation: {
          shards: Array.from({ length: nodes }, () => ({})),
          debris: [],
          sparks: [],
          sequence: { segments: [], beams: [], motes: [], impact: null },
        },
      }) as never;

    const budgeted = budgetClearPresentations(
      [makePresentation('old', 40), makePresentation('new', 40)],
      EFFECT_NODE_BUDGET.clearAndPlacement,
    );

    expect(budgeted.map((entry) => entry.id)).toEqual(['new']);
  });
});
