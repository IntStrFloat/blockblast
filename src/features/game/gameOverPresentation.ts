import type { GameStatus, PlacementEvent } from '@/core/engine';

interface GameOverPresentation {
  visible: boolean;
  fresh: boolean;
  revealDelayMs: number;
}

export function gameOverPresentationFor(
  status: GameStatus,
  lastEvent: PlacementEvent | null,
): GameOverPresentation {
  if (status !== 'over') {
    return { visible: false, fresh: false, revealDelayMs: 0 };
  }
  const fresh = lastEvent?.gameOver === true;
  return {
    visible: true,
    fresh,
    revealDelayMs: fresh ? 800 : 0,
  };
}
