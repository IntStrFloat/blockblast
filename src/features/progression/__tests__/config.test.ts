import { PROGRESSION_CONFIG } from '../logic/config';

describe('PROGRESSION_CONFIG', () => {
  it('кривая стоимости валидна', () => {
    expect(PROGRESSION_CONFIG.levelCost.base).toBeGreaterThan(0);
    expect(PROGRESSION_CONFIG.levelCost.growth).toBeGreaterThan(1);
    expect(PROGRESSION_CONFIG.introLevelCosts?.length).toBeGreaterThan(0);
    for (const cost of PROGRESSION_CONFIG.introLevelCosts ?? []) expect(cost).toBeGreaterThan(0);
  });

  it('tierGaps непустой и положительный', () => {
    expect(PROGRESSION_CONFIG.tierGaps.length).toBeGreaterThan(0);
    for (const gap of PROGRESSION_CONFIG.tierGaps) expect(gap).toBeGreaterThan(0);
  });

  it('у первого мира есть тема', () => {
    expect(PROGRESSION_CONFIG.worldThemeId[1]).toBeDefined();
  });
});
