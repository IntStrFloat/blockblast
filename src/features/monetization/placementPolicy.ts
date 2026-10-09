import { MONETIZATION } from './config';
import type { InterstitialCounter } from './frequency';

export interface ResultAdContext {
  activePlayMs?: number;
  rewardedOfferPresented?: boolean;
  resultContextId?: string;
}

export type PlacementSuppression =
  | 'suppressed_adventure_retry'
  | 'suppressed_short_run'
  | 'suppressed_rewarded_offer';

/** Protect the decision to retry or decline a voluntary reward. */
export function placementSuppression(
  counter: InterstitialCounter,
  context: ResultAdContext,
): PlacementSuppression | null {
  if (context.rewardedOfferPresented) return 'suppressed_rewarded_offer';
  if (counter === 'adventure_fail') return 'suppressed_adventure_retry';
  if (counter === 'gameover' && (
    !Number.isFinite(context.activePlayMs) ||
    (context.activePlayMs ?? 0) < MONETIZATION.placementPolicy.classicMinActiveMs
  )) return 'suppressed_short_run';
  return null;
}
