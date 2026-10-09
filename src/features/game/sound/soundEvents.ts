import type { PlacementEvent } from '@/core/engine';

import type { SoundName } from './sounds';

export function soundForPlacement(event: PlacementEvent): SoundName {
  const lines = event.clearedRows.length + event.clearedCols.length;
  if (lines === 0) return event.gameOver ? 'gameover' : 'drop';
  // Эскалация по максимуму зрелищности хода: серия комбо ИЛИ мульти-линии —
  // аудио должно рассказывать ту же историю, что тряска/похвала на экране.
  const tier = Math.max(lines, event.combo);
  if (tier >= 3 || event.onFire) return 'clear3';
  if (tier === 2) return 'clear2';
  return 'clear1';
}
