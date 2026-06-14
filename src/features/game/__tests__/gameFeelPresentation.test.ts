import type { PlacementEvent } from '@/core/engine';

import {
  buildPlacementPresentation,
  comboFrameFor,
  scoreScaleFor,
} from '../animation/gameFeelPresentation';
import { GAME_FEEL_MOTION } from '../animation/motion';

const CELL_COLORS = ['#ff4d67', '#ffc93c', '#4cc9ff', '#6ef3a5'];
const GEOM = { boardSize: 94, cell: 10, gap: 2 };

function placementEvent(overrides: Partial<PlacementEvent> = {}): PlacementEvent {
  return {
    placed: [
      [3, 3],
      [3, 4],
      [4, 3],
    ],
    colorId: 2,
    clearedRows: [],
    clearedCols: [],
    clearedCells: [],
    clearedColors: [],
    scoreDelta: 24,
    score: 999,
    combo: 1,
    praise: 'none',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
    ...overrides,
  };
}

describe('scoreScaleFor', () => {
  it('uses the locked score tiers', () => {
    expect(scoreScaleFor(999)).toBe(1);
    expect(scoreScaleFor(1000)).toBe(1.1);
    expect(scoreScaleFor(5000)).toBe(1.18);
    expect(scoreScaleFor(10000)).toBe(1.25);
  });
});

describe('buildPlacementPresentation', () => {
  it('is deterministic and keeps normal placement particles within the capped budget', () => {
    const event = placementEvent({
      score: 5400,
      combo: 3,
      clearedRows: [3],
      clearedCells: [
        [3, 0],
        [3, 1],
        [3, 2],
        [3, 3],
      ],
      clearedColors: [1, 2, 3, 4],
    });

    const first = buildPlacementPresentation(event, GEOM, CELL_COLORS, false);
    const second = buildPlacementPresentation(event, GEOM, CELL_COLORS, false);

    expect(second).toEqual(first);
    expect(first.particles.length).toBeGreaterThanOrEqual(GAME_FEEL_MOTION.placementParticleMin);
    expect(first.particles.length).toBeLessThanOrEqual(GAME_FEEL_MOTION.placementParticleMax);
    expect(first.particles.every(({ dx, dy }) => dx !== 0 || dy !== 0)).toBe(true);
  });

  it('uses a restrained local presentation for reduced motion', () => {
    const presentation = buildPlacementPresentation(placementEvent({ score: 2200 }), GEOM, CELL_COLORS, true);

    expect(presentation.particles).not.toHaveLength(0);
    expect(presentation.particles.every(({ dx, dy, rotateDeg }) => dx === 0 && dy === 0 && rotateDeg === 0)).toBe(
      true,
    );
    expect(presentation.burstScale).toBeLessThanOrEqual(GAME_FEEL_MOTION.reducedPlacementBurstScale);
  });
});

describe('comboFrameFor', () => {
  it('keeps combo one at zero intensity', () => {
    expect(comboFrameFor(placementEvent({ combo: 1, clearedRows: [2] }), false).intensity).toBe(0);
  });

  it('starts combo-derived shake at combo three', () => {
    const comboTwo = comboFrameFor(
      placementEvent({ combo: 2, clearedRows: [1], boardCleared: true }),
      false,
    );
    const comboThree = comboFrameFor(
      placementEvent({ combo: 3, clearedRows: [1], boardCleared: true }),
      false,
    );

    expect(comboTwo.intensity).toBeGreaterThan(0);
    expect(comboTwo.shakeAmplitude).toBe(0);
    expect(comboThree.shakeAmplitude).toBeGreaterThan(0);
  });

  it('raises combo intensity and line strength for multi-clear streaks', () => {
    const presentation = comboFrameFor(
      placementEvent({
        combo: 3,
        clearedRows: [1, 2],
        clearedCols: [4],
      }),
      false,
    );

    expect(presentation.intensity).toBeGreaterThan(0);
    expect(presentation.lineStrength).toBeGreaterThan(0);
    expect(presentation.lineStrength).toBeLessThanOrEqual(1);
  });

  it('caps combo and board-clear strength and disables shake for reduced motion', () => {
    const full = comboFrameFor(
      placementEvent({
        combo: 5,
        clearedRows: [0, 1],
        clearedCols: [2, 3],
        boardCleared: true,
      }),
      false,
    );
    const reduced = comboFrameFor(
      placementEvent({
        combo: 5,
        clearedRows: [0, 1],
        clearedCols: [2, 3],
        boardCleared: true,
      }),
      true,
    );

    expect(full.intensity).toBeLessThanOrEqual(1);
    expect(full.boardClearStrength).toBe(1);
    expect(full.shakeAmplitude).toBeLessThanOrEqual(GAME_FEEL_MOTION.comboShakeMax);
    expect(reduced.shakeAmplitude).toBe(0);
  });
});

describe('game-feel budgets', () => {
  it('centralizes hard caps used by the presentation helpers', () => {
    expect(GAME_FEEL_MOTION.placementParticleMax).toBe(12);
    expect(GAME_FEEL_MOTION.recordConfettiMax).toBe(18);
    expect(GAME_FEEL_MOTION.oneLineExternalEffectTargetCap).toBe(64);
    expect(GAME_FEEL_MOTION.crossMultiLineExternalEffectHardCap).toBe(128);
    expect(GAME_FEEL_MOTION.scoreScaleMax).toBe(1.25);
  });
});
