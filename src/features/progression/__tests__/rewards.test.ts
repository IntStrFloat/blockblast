import { PROGRESSION_CONFIG } from '../logic/config';
import {
  helperUnlockLevel,
  isHelperUnlocked,
  rewardForLevel,
  rewardsBetween,
  stageForLevel,
} from '../logic/rewards';
import { worldStartLevels } from '../logic/worlds';

describe('rewardForLevel', () => {
  it('старт мира 2 (ур.4) → world + тема neon + эволюция в стадию 2', () => {
    expect(rewardForLevel(4)).toEqual({ kind: 'world', world: 2, themeId: 'neon', evolveStage: 2 });
  });
  it('старт мира 3 (ур.8) → world без эволюции', () => {
    expect(rewardForLevel(8)).toEqual({ kind: 'world', world: 3, themeId: 'sunset' });
  });
  it('ур.2 → помощник hint (фронт-лоад: награда каждый из первых уровней)', () => {
    expect(rewardForLevel(2)).toEqual({ kind: 'helper', id: 'hint' });
  });
  it('ур.1 → косметика (не world, мир 1 — стартовый)', () => {
    expect(rewardForLevel(1)).toEqual({ kind: 'cosmetic', id: 'hat-casquette' });
  });
  it('пустой уровень (ур.10) → null', () => {
    expect(rewardForLevel(10)).toBeNull();
  });
  it('levelRewards не попадают на старты миров (их шэдоуит world-награда)', () => {
    const starts = worldStartLevels();
    for (const lvl of Object.keys(PROGRESSION_CONFIG.levelRewards).map(Number)) {
      if (lvl === 1) continue; // мир 1 стартовый, world-награды нет
      expect(starts).not.toContain(lvl);
    }
  });
});

describe('rewardsBetween', () => {
  it('дайджест ур.1→4: hint(2), косметика(3), мир 2(4)', () => {
    expect(rewardsBetween(1, 4)).toEqual([
      { kind: 'helper', id: 'hint' },
      { kind: 'cosmetic', id: 'face-glasses' },
      { kind: 'world', world: 2, themeId: 'neon', evolveStage: 2 },
    ]);
  });
  it('пустой диапазон → []', () => {
    expect(rewardsBetween(4, 4)).toEqual([]);
  });
});

describe('stageForLevel', () => {
  it('эволюция по мирам (2→стадия 2 на ур.4, 4→стадия 3 на ур.13, 6→стадия 4 на ур.27)', () => {
    expect(stageForLevel(1)).toBe(1);
    expect(stageForLevel(4)).toBe(2);
    expect(stageForLevel(8)).toBe(2);
    expect(stageForLevel(13)).toBe(3);
    expect(stageForLevel(27)).toBe(4);
  });
});

describe('helper unlock gate (источник истины для маскота, спека 15 §3)', () => {
  it('возвращает уровень выдачи помощника наградой', () => {
    expect(helperUnlockLevel('hint')).toBe(2);
    expect(helperUnlockLevel('swap')).toBe(6);
  });

  it('hint открыт с ур.2, swap — с ур.6', () => {
    expect(isHelperUnlocked('hint', 1)).toBe(false);
    expect(isHelperUnlocked('hint', 2)).toBe(true);
    expect(isHelperUnlocked('swap', 5)).toBe(false);
    expect(isHelperUnlocked('swap', 6)).toBe(true);
  });
});
