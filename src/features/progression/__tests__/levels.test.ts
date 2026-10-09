import { PROGRESSION_CONFIG } from '../logic/config';
import { levelCost, thresholdForLevel, levelForPoints, progressFor } from '../logic/levels';

const ORIGINAL_BASE = 7500;
const ORIGINAL_GROWTH = 1.12;

function originalFormulaCost(level: number): number {
  return Math.round(ORIGINAL_BASE * Math.pow(ORIGINAL_GROWTH, level - 1));
}

describe('levelCost', () => {
  it('uses the explicit intro schedule for the first rewards', () => {
    expect(levelCost(1)).toBe(2000);
    expect(levelCost(2)).toBe(3500);
    expect(levelCost(3)).toBe(5000);
  });
  it('returns to the original long-tail formula after the intro levels', () => {
    expect(levelCost(4)).toBe(originalFormulaCost(4));
    expect(levelCost(7)).toBe(originalFormulaCost(7));
    expect(levelCost(PROGRESSION_CONFIG.maxAuthoredLevel)).toBe(
      originalFormulaCost(PROGRESSION_CONFIG.maxAuthoredLevel),
    );
  });
  it('stays backward compatible when a custom config does not define intro costs', () => {
    const cfg = {
      ...PROGRESSION_CONFIG,
      introLevelCosts: undefined,
    };
    expect(levelCost(1, cfg)).toBe(originalFormulaCost(1));
    expect(levelCost(7, cfg)).toBe(originalFormulaCost(7));
  });
  it('строго возрастает на всём authored-диапазоне', () => {
    for (let L = 1; L < PROGRESSION_CONFIG.maxAuthoredLevel; L++) {
      expect(levelCost(L + 1)).toBeGreaterThan(levelCost(L));
    }
  });
});

describe('thresholdForLevel', () => {
  it('reach уровня 1 = 0 очков', () => {
    expect(thresholdForLevel(1)).toBe(0);
  });
  it('reach уровня 2 = cost(1)', () => {
    expect(thresholdForLevel(2)).toBe(levelCost(1));
  });
  it('reach уровня 3 = cost(1)+cost(2)', () => {
    expect(thresholdForLevel(3)).toBe(levelCost(1) + levelCost(2));
  });
});

describe('levelForPoints', () => {
  it('инверсия порога точна на границах L=1..50', () => {
    for (let L = 1; L <= 50; L++) {
      expect(levelForPoints(thresholdForLevel(L))).toBe(L);
    }
  });
  it('на 1 очко ниже порога — предыдущий уровень', () => {
    expect(levelForPoints(thresholdForLevel(5) - 1)).toBe(4);
  });
  it('отрицательные очки → уровень 1', () => {
    expect(levelForPoints(-100)).toBe(1);
  });
});

describe('progressFor', () => {
  it('0 очков → уровень 1, мир 1, в уровне 0, до следующего = cost(1)', () => {
    expect(progressFor(0)).toEqual({ level: 1, world: 1, pointsInLevel: 0, pointsToNext: 2000 });
  });
  it('ровно на пороге уровня 2', () => {
    expect(progressFor(thresholdForLevel(2))).toEqual({
      level: 2,
      world: 1,
      pointsInLevel: 0,
      pointsToNext: levelCost(2),
    });
  });
  it('середина уровня 3', () => {
    const p = thresholdForLevel(3) + 5;
    expect(progressFor(p)).toEqual({
      level: 3,
      world: 1,
      pointsInLevel: 5,
      pointsToNext: levelCost(3) - 5,
    });
  });
  it('уровень 4 уже в мире 2', () => {
    expect(progressFor(thresholdForLevel(4)).world).toBe(2);
  });
  it('keeps the early thresholds discounted while preserving the old long-tail slope', () => {
    expect(thresholdForLevel(2)).toBe(2_000);
    expect(thresholdForLevel(3)).toBe(5_500);
    expect(thresholdForLevel(4)).toBe(10_500);
    expect(thresholdForLevel(5)).toBe(10_500 + originalFormulaCost(4));
  });
  it('is safe and monotonic through maxAuthoredLevel', () => {
    let previousThreshold = -1;
    for (let level = 1; level <= PROGRESSION_CONFIG.maxAuthoredLevel; level += 1) {
      const threshold = thresholdForLevel(level);
      expect(threshold).toBeGreaterThan(previousThreshold);
      expect(levelForPoints(threshold)).toBe(level);
      previousThreshold = threshold;
    }
    expect(progressFor(thresholdForLevel(PROGRESSION_CONFIG.maxAuthoredLevel))).toEqual(
      expect.objectContaining({
        level: PROGRESSION_CONFIG.maxAuthoredLevel,
        pointsInLevel: 0,
        pointsToNext: levelCost(PROGRESSION_CONFIG.maxAuthoredLevel),
      }),
    );
  });
  it('keeps custom configs without intro costs working', () => {
    const cfg = {
      ...PROGRESSION_CONFIG,
      introLevelCosts: undefined,
    };
    expect(thresholdForLevel(2, cfg)).toBe(originalFormulaCost(1));
    expect(progressFor(0, cfg).pointsToNext).toBe(originalFormulaCost(1));
  });
});
