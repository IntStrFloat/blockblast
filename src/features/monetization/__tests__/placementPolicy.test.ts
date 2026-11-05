import { placementSuppression } from '../placementPolicy';

describe('contextual ad breaks', () => {
  it('never monetizes an Adventure retry with an interstitial', () => {
    expect(placementSuppression('adventure_fail', { activePlayMs: 900_000 }))
      .toBe('suppressed_adventure_retry');
  });
  it.each([undefined, NaN, Infinity, -1, 0, 119_999])('protects short or unmeasured Classic attempts (%s)', (activePlayMs) => {
    expect(placementSuppression('gameover', { activePlayMs })).toBe('suppressed_short_run');
  });
  it('allows an established Classic result or a win to reach frequency checks', () => {
    expect(placementSuppression('gameover', { activePlayMs: 120_000 })).toBeNull();
    expect(placementSuppression('adventure_level', { activePlayMs: 15_000 })).toBeNull();
  });
});
