import type { GameStatus, PlacementEvent } from '@/core/engine';

interface GameOverPresentation {
  visible: boolean;
  fresh: boolean;
  revealDelayMs: number;
}

export function gameOverPresentationFor(
  status: GameStatus,
  lastEvent: PlacementEvent | null,
  reducedMotion = false,
): GameOverPresentation {
  if (status !== 'over') {
    return { visible: false, fresh: false, revealDelayMs: 0 };
  }
  const fresh = lastEvent?.gameOver === true;
  return {
    visible: true,
    fresh,
    revealDelayMs: fresh && !reducedMotion ? 960 + (lastEvent?.clearedCells?.length ? 420 : 0) : 0,
  };
}
