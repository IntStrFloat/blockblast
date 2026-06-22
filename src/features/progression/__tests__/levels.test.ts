import { levelCost, thresholdForLevel, levelForPoints, progressFor } from '../logic/levels';

describe('levelCost', () => {
  it('cost(1) = base = 14000', () => {
    expect(levelCost(1)).toBe(14000);
  });
  it('строго возрастает', () => {
    for (let L = 1; L < 40; L++) {
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
    expect(progressFor(0)).toEqual({ level: 1, world: 1, pointsInLevel: 0, pointsToNext: 14000 });
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
  it('уровень 6 уже в мире 2', () => {
    expect(progressFor(thresholdForLevel(6)).world).toBe(2);
  });
});
