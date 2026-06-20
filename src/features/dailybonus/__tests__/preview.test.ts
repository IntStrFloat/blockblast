import { DAILY_CONFIG } from '../logic/config';
import { dailyPreview } from '../logic/reward';

describe('dailyPreview', () => {
  it('clamps the day to 1 when the streak is lost or zero', () => {
    expect(dailyPreview(0)).toEqual({ day: 1, multiplier: 1, points: 500 });
  });

  it('maps the streak day to its multiplier and points', () => {
    expect(dailyPreview(3)).toEqual({ day: 3, multiplier: 1.5, points: 750 });
  });

  it('caps the day and multiplier at the configured ceiling (day 7+)', () => {
    const cap = DAILY_CONFIG.streakMultiplier.length;
    const ceil = DAILY_CONFIG.streakMultiplier[cap - 1];
    expect(dailyPreview(99)).toEqual({
      day: cap,
      multiplier: ceil,
      points: Math.round(DAILY_CONFIG.basePoints * ceil),
    });
  });
});
