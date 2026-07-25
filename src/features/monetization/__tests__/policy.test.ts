import {
  getRewardedCtaPolicy,
  shouldShowGameBanner,
  shouldShowHomeBanner,
} from '../policy';

describe('banner policy', () => {
  it('never permits a Home banner', () => {
    expect(shouldShowHomeBanner()).toBe(false);
  });

  it('permits the game banner only after FTUE and two completed games', () => {
    expect(shouldShowGameBanner({ ftueComplete: false, gamesPlayed: 20 })).toBe(false);
    expect(shouldShowGameBanner({ ftueComplete: true, gamesPlayed: 1 })).toBe(false);
    expect(shouldShowGameBanner({ ftueComplete: true, gamesPlayed: 2 })).toBe(true);
  });
});

describe('rewarded CTA policy', () => {
  it('hides an unavailable or disallowed rewarded action', () => {
    expect(
      getRewardedCtaPolicy({ offerAllowed: true, rewardedReady: false, busy: false }),
    ).toEqual({ visible: false, disabled: false });
    expect(
      getRewardedCtaPolicy({ offerAllowed: false, rewardedReady: true, busy: false }),
    ).toEqual({ visible: false, disabled: false });
  });

  it('shows a ready action and disables it only while busy', () => {
    expect(
      getRewardedCtaPolicy({ offerAllowed: true, rewardedReady: true, busy: false }),
    ).toEqual({ visible: true, disabled: false });
    expect(
      getRewardedCtaPolicy({ offerAllowed: true, rewardedReady: true, busy: true }),
    ).toEqual({ visible: true, disabled: true });
  });
});
