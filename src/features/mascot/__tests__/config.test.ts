import { MASCOT_CONFIG, xpToNext } from '../logic/config';
import { COSMETICS } from '../logic/cosmetics';

describe('MASCOT_CONFIG.stageBounds', () => {
  it('covers levels 1..24 continuously with no gaps or overlaps', () => {
    const bounds = MASCOT_CONFIG.stageBounds;

    // Collect all level numbers covered
    const covered: number[] = [];
    for (const b of bounds) {
      for (let lvl = b.from; lvl <= b.to; lvl++) {
        covered.push(lvl);
      }
    }

    // No duplicates
    const unique = new Set(covered);
    expect(unique.size).toBe(covered.length);

    // Exact set 1..24
    for (let lvl = 1; lvl <= 24; lvl++) {
      expect(unique.has(lvl)).toBe(true);
    }

    // Nothing outside 1..24
    expect(Math.min(...covered)).toBe(1);
    expect(Math.max(...covered)).toBe(24);
  });
});

describe('MASCOT_CONFIG.rewards', () => {
  const cosmeticIds = new Set(COSMETICS.map(c => c.id));

  it('every cosmetic reward references an existing COSMETICS id', () => {
    for (let lvl = 1; lvl <= MASCOT_CONFIG.maxLevel; lvl++) {
      const reward = MASCOT_CONFIG.rewards[lvl];
      expect(reward).toBeDefined();
      if (!reward) continue;
      if (reward.kind === 'cosmetic') {
        expect(cosmeticIds.has(reward.id)).toBe(true);
      }
    }
  });

  it('each level 1..maxLevel has a defined reward, with exactly 2 helpers and 22 cosmetics', () => {
    let cosmeticCount = 0;
    let helperCount = 0;
    for (let lvl = 1; lvl <= MASCOT_CONFIG.maxLevel; lvl++) {
      const reward = MASCOT_CONFIG.rewards[lvl];
      expect(reward).toBeDefined();
      if (!reward) continue;
      if (reward.kind === 'cosmetic') cosmeticCount++;
      if (reward.kind === 'helper') helperCount++;
    }
    expect(helperCount).toBe(2);
    expect(cosmeticCount).toBe(22);
  });

  it('level 5 rewards hint helper', () => {
    expect(MASCOT_CONFIG.rewards[5]).toEqual({ kind: 'helper', id: 'hint' });
  });

  it('level 12 rewards swap helper', () => {
    expect(MASCOT_CONFIG.rewards[12]).toEqual({ kind: 'helper', id: 'swap' });
  });
});

describe('xpToNext', () => {
  it('xpToNext(1) === 80', () => {
    expect(xpToNext(1)).toBe(80);
  });

  it('is strictly increasing for levels 1..24', () => {
    for (let lvl = 1; lvl < 24; lvl++) {
      expect(xpToNext(lvl + 1)).toBeGreaterThan(xpToNext(lvl));
    }
  });
});
