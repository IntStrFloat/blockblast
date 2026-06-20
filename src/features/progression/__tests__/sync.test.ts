import { awardDelta, cosmeticRewardIdsThroughLevel } from '../logic/sync';

describe('awardDelta', () => {
  it('первая выдача = весь финальный счёт', () => {
    expect(awardDelta(0, 1000)).toBe(1000);
  });
  it('после ревайва — только прирост', () => {
    expect(awardDelta(1000, 1500)).toBe(500);
  });
  it('повтор без прироста → 0', () => {
    expect(awardDelta(1500, 1500)).toBe(0);
  });
  it('отрицательная дельта → 0', () => {
    expect(awardDelta(1000, 800)).toBe(0);
  });
});

describe('cosmeticRewardIdsThroughLevel', () => {
  it('до уровня 4 — только косметика (L1,3,4), пустые/помощники пропущены', () => {
    expect(cosmeticRewardIdsThroughLevel(4)).toEqual([
      'hat-casquette',
      'face-glasses',
      'acc-headphones',
    ]);
  });
  it('до уровня 8 добавляет skin-mint (мир/помощник не косметика)', () => {
    expect(cosmeticRewardIdsThroughLevel(8)).toEqual([
      'hat-casquette',
      'face-glasses',
      'acc-headphones',
      'skin-mint',
    ]);
  });
});
