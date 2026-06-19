import { MASCOT_CONFIG, xpToNext } from '../logic/config';
import { stageForLevel, progressFor, rewardForLevel } from '../logic/progression';

// Вычисляем общее количество очков, достаточное для достижения максимального уровня
// Сумма xpToNext(1) + xpToNext(2) + ... + xpToNext(maxLevel-1) переводит с уровня 1 до maxLevel
function totalXpForMaxLevel(): number {
  let sum = 0;
  for (let lvl = 1; lvl < MASCOT_CONFIG.maxLevel; lvl++) {
    sum += xpToNext(lvl);
  }
  return sum;
}

describe('stageForLevel', () => {
  it('level 4 → stage 1', () => {
    expect(stageForLevel(4)).toBe(1);
  });

  it('level 5 → stage 2', () => {
    expect(stageForLevel(5)).toBe(2);
  });

  it('level 12 → stage 3', () => {
    expect(stageForLevel(12)).toBe(3);
  });

  it('level 20 → stage 4', () => {
    expect(stageForLevel(20)).toBe(4);
  });

  it('level 99 → stage 4 (clamp above maxLevel)', () => {
    expect(stageForLevel(99)).toBe(4);
  });

  it('level 0 → stage 1 (clamp below 1)', () => {
    expect(stageForLevel(0)).toBe(1);
  });
});

describe('progressFor', () => {
  it('progressFor(0) → level 1, stage 1, xpInLevel 0, xpToNext 80', () => {
    expect(progressFor(0)).toEqual({ level: 1, stage: 1, xpInLevel: 0, xpToNext: 80 });
  });

  it('progressFor(-100) clamps to level 1, stage 1, xpInLevel 0, xpToNext 80', () => {
    expect(progressFor(-100)).toEqual({ level: 1, stage: 1, xpInLevel: 0, xpToNext: 80 });
  });

  it('totalXp just below first threshold keeps level 1 with correct xpInLevel', () => {
    const threshold = xpToNext(1); // 80
    const xp = threshold - 1;
    expect(progressFor(xp)).toEqual({
      level: 1,
      stage: 1,
      xpInLevel: xp,
      xpToNext: threshold,
    });
  });

  it('totalXp exactly at first threshold advances to level 2', () => {
    const threshold = xpToNext(1); // 80
    expect(progressFor(threshold)).toEqual({
      level: 2,
      stage: 1,
      xpInLevel: 0,
      xpToNext: xpToNext(2),
    });
  });

  it('accumulating points across multiple thresholds yields correct level and remainder', () => {
    // Points to advance from level 1 → 3: xpToNext(1) + xpToNext(2)
    const pointsForLevel3 = xpToNext(1) + xpToNext(2);
    // Adding 5 more points into level 3
    const totalXp = pointsForLevel3 + 5;
    expect(progressFor(totalXp)).toEqual({
      level: 3,
      stage: 1,
      xpInLevel: 5,
      xpToNext: xpToNext(3),
    });
  });

  it('points crossing stage boundary (levels 1→5) lands in stage 2', () => {
    // Points to reach level 5: sum xpToNext(1..4)
    let xp = 0;
    for (let lvl = 1; lvl <= 4; lvl++) {
      xp += xpToNext(lvl);
    }
    const result = progressFor(xp);
    expect(result.level).toBe(5);
    expect(result.stage).toBe(2);
    expect(result.xpInLevel).toBe(0);
    expect(result.xpToNext).toBe(xpToNext(5));
  });

  it('at or above total points for max level → level 24, stage 4, xpToNext 0, xpInLevel 0', () => {
    const maxXp = totalXpForMaxLevel();
    expect(progressFor(maxXp)).toEqual({ level: 24, stage: 4, xpInLevel: 0, xpToNext: 0 });
  });

  it('points well above max level also clamps to level 24', () => {
    const maxXp = totalXpForMaxLevel();
    expect(progressFor(maxXp + 9999)).toEqual({ level: 24, stage: 4, xpInLevel: 0, xpToNext: 0 });
  });
});

describe('rewardForLevel', () => {
  it('level 5 → helper hint', () => {
    expect(rewardForLevel(5)).toEqual({ kind: 'helper', id: 'hint' });
  });

  it('level 12 → helper swap', () => {
    expect(rewardForLevel(12)).toEqual({ kind: 'helper', id: 'swap' });
  });

  it('level 2 → cosmetic', () => {
    const reward = rewardForLevel(2);
    expect(reward).not.toBeNull();
    expect(reward?.kind).toBe('cosmetic');
  });

  it('level 99 → null (out of range)', () => {
    expect(rewardForLevel(99)).toBeNull();
  });
});
