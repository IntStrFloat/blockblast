import { useState } from 'react';

import type { GameBannerEligibility } from './policy';

/** Refresh between runs, never resize the board on FTUE completion or revive. */
export function useGameBannerEligibility(
  runId: string | null,
  gamesPlayed: number,
  ftueComplete: boolean,
): GameBannerEligibility {
  const [snapshot, setSnapshot] = useState({ runId, gamesPlayed, ftueComplete });
  if (snapshot.runId !== runId) {
    // React rerenders this component before committing its children.
    setSnapshot({ runId, gamesPlayed, ftueComplete });
  }
  return snapshot;
}
