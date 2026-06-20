import { canUseHelper } from '../logic/rules';

// Уровни разлока помощников читаются из progression.levelRewards: hint @5, swap @9.
describe('canUseHelper', () => {
  const today = '2026-06-13';

  it('hint: not used today, level 5 → true', () => {
    expect(canUseHelper(undefined, today, 5, 'hint')).toBe(true);
  });

  it('hint: level 4 → false (below unlock)', () => {
    expect(canUseHelper(undefined, today, 4, 'hint')).toBe(false);
  });

  it('hint: used today without a charge → false', () => {
    expect(canUseHelper(today, today, 9, 'hint')).toBe(false);
  });

  it('hint: used today but holding a charge → true', () => {
    expect(canUseHelper(today, today, 9, 'hint', 1)).toBe(true);
  });

  it('hint: used yesterday, level 5 → true', () => {
    expect(canUseHelper('2026-06-12', today, 5, 'hint')).toBe(true);
  });

  it('swap: level 9 → true', () => {
    expect(canUseHelper(undefined, today, 9, 'swap')).toBe(true);
  });

  it('swap: level 8 → false (below unlock)', () => {
    expect(canUseHelper(undefined, today, 8, 'swap')).toBe(false);
  });

  it('a charge never bypasses the level gate', () => {
    expect(canUseHelper(today, today, 1, 'swap', 5)).toBe(false);
  });
});
