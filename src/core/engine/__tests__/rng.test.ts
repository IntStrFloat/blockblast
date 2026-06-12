import { rngInt, rngNext, seedFromTime } from '../rng';

describe('rng (mulberry32, чистые функции)', () => {
  it('детерминирован: одинаковый seed даёт одинаковую последовательность', () => {
    let a = 12345;
    let b = 12345;
    for (let i = 0; i < 50; i++) {
      const ra = rngNext(a);
      const rb = rngNext(b);
      expect(ra.value).toBe(rb.value);
      a = ra.state;
      b = rb.state;
    }
  });

  it('разные seed дают разные последовательности', () => {
    const a = rngNext(1).value;
    const b = rngNext(2).value;
    expect(a).not.toBe(b);
  });

  it('значения в [0, 1)', () => {
    let s = 777;
    for (let i = 0; i < 200; i++) {
      const r = rngNext(s);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      s = r.state;
    }
  });

  it('rngInt в диапазоне [0, max) и детерминирован', () => {
    let s = 42;
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const r = rngInt(s, 6);
      expect(Number.isInteger(r.value)).toBe(true);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(6);
      seen.add(r.value);
      s = r.state;
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(rngInt(42, 6).value).toBe(rngInt(42, 6).value);
  });

  it('seedFromTime возвращает целое', () => {
    expect(Number.isInteger(seedFromTime())).toBe(true);
  });
});
