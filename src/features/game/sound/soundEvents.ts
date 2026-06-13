import type { PlacementEvent } from '@/core/engine';

import type { SoundName } from './sounds';

export function soundForPlacement(event: PlacementEvent): SoundName {
  if (event.gameOver) return 'gameover';
  const lines = event.clearedRows.length + event.clearedCols.length;
  if (lines === 0) return 'drop';
  if (lines >= 3 || event.onFire) return 'clear3';
  if (lines === 2) return 'clear2';
  return 'clear1';
}
