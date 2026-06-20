import { rewardForLevel, rewardsBetween, stageForLevel } from '../logic/rewards';

describe('rewardForLevel', () => {
  it('старт мира 2 (ур.6) → world + тема neon + эволюция в стадию 2', () => {
    expect(rewardForLevel(6)).toEqual({ kind: 'world', world: 2, themeId: 'neon', evolveStage: 2 });
  });
  it('старт мира 3 (ур.13) → world без эволюции', () => {
    expect(rewardForLevel(13)).toEqual({ kind: 'world', world: 3, themeId: 'sunset' });
  });
  it('ур.5 → помощник hint', () => {
    expect(rewardForLevel(5)).toEqual({ kind: 'helper', id: 'hint' });
  });
  it('ур.1 → косметика (не world, мир 1 — стартовый)', () => {
    expect(rewardForLevel(1)).toEqual({ kind: 'cosmetic', id: 'hat-casquette' });
  });
  it('пустой уровень (ур.2) → null', () => {
    expect(rewardForLevel(2)).toBeNull();
  });
});

describe('rewardsBetween', () => {
  it('дайджест ур.4→6 включает помощника(5) и мир(6), пропускает пустые', () => {
    expect(rewardsBetween(4, 6)).toEqual([
      { kind: 'helper', id: 'hint' },
      { kind: 'world', world: 2, themeId: 'neon', evolveStage: 2 },
    ]);
  });
  it('пустой диапазон → []', () => {
    expect(rewardsBetween(6, 6)).toEqual([]);
  });
});

describe('stageForLevel', () => {
  it('эволюция по мирам', () => {
    expect(stageForLevel(1)).toBe(1);
    expect(stageForLevel(6)).toBe(2);
    expect(stageForLevel(13)).toBe(2);
    expect(stageForLevel(22)).toBe(3);
    expect(stageForLevel(47)).toBe(4);
  });
});
