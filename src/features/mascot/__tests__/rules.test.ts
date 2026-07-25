import { canUseHelper } from '../logic/rules';

// Уровни разлока помощников читаются из progression.levelRewards: hint @2, swap @6.
describe('canUseHelper', () => {
  const today = '2026-06-13';

  it('hint: not used today, level 2 → true', () => {
    expect(canUseHelper(undefined, today, 2, 'hint')).toBe(true);
  });

  it('hint: level 1 → false (below unlock)', () => {
    expect(canUseHelper(undefined, today, 1, 'hint')).toBe(false);
  });

  it('hint: used today without a charge → false', () => {
    expect(canUseHelper(today, today, 6, 'hint')).toBe(false);
  });

  it('hint: used today but holding a charge → true', () => {
    expect(canUseHelper(today, today, 6, 'hint', 1)).toBe(true);
  });

  it('hint: used yesterday, level 2 → true', () => {
    expect(canUseHelper('2026-06-12', today, 2, 'hint')).toBe(true);
  });

  it('swap: level 6 → true', () => {
    expect(canUseHelper(undefined, today, 6, 'swap')).toBe(true);
  });

  it('swap: level 5 → false (below unlock)', () => {
    expect(canUseHelper(undefined, today, 5, 'swap')).toBe(false);
  });

  it('a charge never bypasses the level gate', () => {
    expect(canUseHelper(today, today, 1, 'swap', 5)).toBe(false);
  });
});
