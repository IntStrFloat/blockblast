import { computeDaily } from '../logic/reward';
import { DAILY_CONFIG } from '../logic/config';

describe('computeDaily', () => {
  it('детерминирован по rngState', () => {
    expect(computeDaily(3, 12345)).toEqual(computeDaily(3, 12345));
  });

  it('продвигает rngState', () => {
    expect(computeDaily(3, 12345).rngState).not.toBe(12345);
  });

  it('множитель и потолок ×2.5 на дне 7+', () => {
    expect(computeDaily(1, 1).multiplier).toBe(1);
    expect(computeDaily(5, 1).multiplier).toBe(2);
    expect(computeDaily(7, 1).multiplier).toBe(2.5);
    expect(computeDaily(99, 1).multiplier).toBe(2.5);
  });

  it('points = round(base × множитель)', () => {
    expect(computeDaily(1, 1).points).toBe(500);
    expect(computeDaily(5, 1).points).toBe(1000);
    expect(computeDaily(7, 1).points).toBe(1250);
  });

  it('на стрике, кратном 7, косметика гарантирована', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = computeDaily(7, seed);
      expect(r.drop).not.toBeNull();
      expect(r.drop?.type).toBe('cosmetic');
    }
  });

  it('частота дропа близка к конфигу (день 6, шанс 0.42)', () => {
    let drops = 0;
    const N = 5000;
    for (let seed = 0; seed < N; seed++) {
      if (computeDaily(6, seed).drop !== null) drops++;
    }
    const rate = drops / N;
    expect(rate).toBeGreaterThan(0.37);
    expect(rate).toBeLessThan(0.47);
  });

  it('внутри дропа helperCharge доминирует (~60%)', () => {
    let charge = 0;
    let total = 0;
    for (let seed = 0; seed < 5000; seed++) {
      const d = computeDaily(6, seed).drop;
      if (d === null) continue;
      total++;
      if (d.type === 'helperCharge') charge++;
    }
    const frac = charge / total;
    expect(frac).toBeGreaterThan(0.5);
    expect(frac).toBeLessThan(0.7);
  });

  it('id дропов берутся из конфиг-пулов', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const d = computeDaily(6, seed).drop;
      if (d === null) continue;
      if (d.type === 'cosmetic') expect(DAILY_CONFIG.dailyCosmeticPool).toContain(d.id);
      if (d.type === 'rare') expect(DAILY_CONFIG.rarePool).toContain(d.id);
      if (d.type === 'helperCharge') expect(DAILY_CONFIG.helperIds).toContain(d.helper);
    }
  });
});
