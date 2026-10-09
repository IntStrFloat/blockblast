import { useEffect } from 'react';

import { useMascot } from '@/features/mascot/store';

import { cosmeticRewardIdsThroughLevel } from '../logic/sync';
import { useProgression } from '../store';

/**
 * Mount-time reconciliation for cosmetics already earned by persisted progression.
 * Run settlement itself is synchronous and idempotent in game/store.
 *
 * Монтируется один раз на стабильном экране (Game). Тема мира переключается внутри
 * progression.addPoints; стадия Капи выводится из Уровня Игры при полном декаплинге (15).
 */

export function useProgressionSync(): void {
  // Сверка гардероба с достигнутым уровнем (одноразово на маунте).
  useEffect(() => {
    const level = useProgression.getState().level;
    for (const id of cosmeticRewardIdsThroughLevel(level)) {
      useMascot.getState().unlock(id);
    }
  }, []);
}
