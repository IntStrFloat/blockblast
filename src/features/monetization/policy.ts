export interface GameBannerEligibility {
  ftueComplete: boolean;
  gamesPlayed: number;
}

/** Home is intentionally an ad-free trust and re-entry surface. */
export function shouldShowHomeBanner(): false {
  return false;
}

/** Protect FTUE and the first completed game from an in-game banner. */
export function shouldShowGameBanner(input: GameBannerEligibility): boolean {
  return input.ftueComplete && input.gamesPlayed >= 2;
}

export interface RewardedCtaInput {
  offerAllowed: boolean;
  rewardedReady: boolean;
  busy: boolean;
}

export interface RewardedCtaPolicy {
  visible: boolean;
  disabled: boolean;
}

/**
 * An unavailable rewarded action is hidden, not rendered as a dead CTA.
 * Once available, it is disabled only while another ad/action is in flight.
 */
export function getRewardedCtaPolicy(input: RewardedCtaInput): RewardedCtaPolicy {
  const visible = input.offerAllowed && input.rewardedReady;
  return { visible, disabled: visible && input.busy };
}
