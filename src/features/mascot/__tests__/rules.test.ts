import { canFeed, canUseHelper } from '../logic/rules';

// ---------------------------------------------------------------------------
// canFeed
// ---------------------------------------------------------------------------
describe('canFeed', () => {
  it('null lastFedDay → true', () => {
    expect(canFeed(null, '2026-06-13')).toBe(true);
  });

  it('lastFedDay === today → false', () => {
    expect(canFeed('2026-06-13', '2026-06-13')).toBe(false);
  });

  it('lastFedDay is yesterday → true', () => {
    expect(canFeed('2026-06-12', '2026-06-13')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canUseHelper
// ---------------------------------------------------------------------------
describe('canUseHelper', () => {
  const today = '2026-06-13';

  // hint: unlockLevel 5
  it('hint: usedDay undefined, level 5 → true', () => {
    expect(canUseHelper(undefined, today, 5, 'hint')).toBe(true);
  });

  it('hint: usedDay undefined, level 4 → false (below unlock)', () => {
    expect(canUseHelper(undefined, today, 4, 'hint')).toBe(false);
  });

  it('hint: usedDay === today, level 9 → false (already used today)', () => {
    expect(canUseHelper(today, today, 9, 'hint')).toBe(false);
  });

  it('hint: usedDay is yesterday, level 5 → true', () => {
    expect(canUseHelper('2026-06-12', today, 5, 'hint')).toBe(true);
  });

  // swap: unlockLevel 12
  it('swap: usedDay undefined, level 12 → true', () => {
    expect(canUseHelper(undefined, today, 12, 'swap')).toBe(true);
  });

  it('swap: usedDay undefined, level 11 → false (below unlock)', () => {
    expect(canUseHelper(undefined, today, 11, 'swap')).toBe(false);
  });
});
