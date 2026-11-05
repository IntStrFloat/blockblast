import { MONETIZATION } from './config';
import type { InterstitialCounter } from './frequency';

export interface ResultAdContext {
  activePlayMs?: number;
  resultContextId?: string;
}

export type PlacementSuppression =
  | 'suppressed_adventure_retry'
  | 'suppressed_short_run';

/** Keep automatic ads at established game breaks. Rewarded cooldown is checked separately. */
export function placementSuppression(
  counter: InterstitialCounter,
  context: ResultAdContext,
): PlacementSuppression | null {
  if (counter === 'adventure_fail') return 'suppressed_adventure_retry';
  if (counter === 'gameover' && (
    !Number.isFinite(context.activePlayMs) ||
    (context.activePlayMs ?? 0) < MONETIZATION.placementPolicy.classicMinActiveMs
  )) return 'suppressed_short_run';
  return null;
}
