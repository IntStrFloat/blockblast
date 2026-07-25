import { useEffect, useRef } from 'react';

import { useGameStore } from '@/features/game/store';
import { useMascot } from '@/features/mascot/store';

import { awardDelta, cosmeticRewardIdsThroughLevel } from '../logic/sync';
import { useProgression } from '../store';

/**
 * Координатор синка очков: подписывается на game-store и на game-over начисляет
 * дельту счёта в Уровень Игры, разблокируя косметику-награды через mascot.unlock.
 * Держит features/game независимым (подписка, без импорта progression внутрь game).
 *
 * Монтируется один раз на стабильном экране (Game). Тема мира переключается внутри
 * progression.addPoints; стадия Капи выводится из Уровня Игры при полном декаплинге (15).
 */

// Reveal показываем ПОСЛЕ оверлея Game Over (тот появляется через ~0.8с анимации
// заливки доски). Иначе полноэкранный «Уровень N» выскакивает в момент терминального
// хода — раньше Game Over — и читается как «повышение уровня закончило игру»
// (обратная причинность: это game over начисляет очки, а не level-up обрывает партию).
const REVEAL_AFTER_GAME_OVER_MS = 1600;
export function useProgressionSync(): void {
  const awardedRef = useRef(0);
  const epochRef = useRef(useGameStore.getState().epoch);

  // Сверка гардероба с достигнутым уровнем (одноразово на маунте).
  useEffect(() => {
    const level = useProgression.getState().level;
    for (const id of cosmeticRewardIdsThroughLevel(level)) {
      useMascot.getState().unlock(id);
    }
  }, []);

  useEffect(() => {
    const unsub = useGameStore.subscribe((state) => {
      if (state.epoch !== epochRef.current) {
        epochRef.current = state.epoch;
        awardedRef.current = 0;
      }
      if (state.finalResult === null) return;

      const delta = awardDelta(awardedRef.current, state.game.score);
      if (delta <= 0) return;

      awardedRef.current += delta;
      const res = useProgression.getState().addPoints(delta);
      for (const r of res.rewards) {
        if (r.kind === 'cosmetic') useMascot.getState().unlock(r.id);
      }
      // Level-up reveal принадлежит координатору, а не маскоту (спека 15 §4).
      // Таймер намеренно не отменяется: стор глобальный, потерять reveal хуже,
      // чем показать его на пару секунд позже (даже поверх новой партии).
      if (res.toLevel > res.fromLevel) {
        const reveal = { level: res.toLevel, rewards: res.rewards };
        setTimeout(() => useProgression.getState().setReveal(reveal), REVEAL_AFTER_GAME_OVER_MS);
      }
    });
    return unsub;
  }, []);
}
