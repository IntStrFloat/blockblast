import { useCallback, useEffect } from 'react';
import * as Haptics from 'expo-haptics';

import { useSettings } from '@/features/settings';

import { useGameStore } from '../store';
import { soundForPlacement } from './soundEvents';
import { initSounds, playSound } from './sounds';

function haptic(fn: () => Promise<void>): void {
  fn().catch(() => {}); // на части Android вибромотора нет
}

/**
 * Маппинг PlacementEvent → звук + хаптика (таблицы спеки 04).
 * Возвращает onGrab для DragCtx (фидбек захвата фигуры).
 */
export function useGameFeedback(): { onGrab: () => void } {
  const lastEvent = useGameStore((s) => s.lastEvent);
  const finalResult = useGameStore((s) => s.finalResult);
  const sound = useSettings((s) => s.sound);
  const hapticsOn = useSettings((s) => s.haptics);

  useEffect(() => {
    initSounds();
  }, []);

  // Фидбек хода
  useEffect(() => {
    if (!lastEvent) return;
    const lines = lastEvent.clearedRows.length + lastEvent.clearedCols.length;

    if (sound) playSound(soundForPlacement(lastEvent));

    if (hapticsOn) {
      if (lastEvent.gameOver) {
        haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
      } else if (lines >= 3 || lastEvent.onFire) {
        haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      } else if (lines === 2) {
        haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      } else if (lines === 1) {
        haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
      } else {
        haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      }
    }
  }, [hapticsOn, lastEvent, sound]);

  // Фанфара нового рекорда
  useEffect(() => {
    if (finalResult?.newRecord && sound) {
      const timer = setTimeout(() => playSound('record'), 600);
      return () => clearTimeout(timer);
    }
  }, [finalResult, sound]);

  const onGrab = useCallback(() => {
    if (sound) playSound('pickup');
    if (hapticsOn) haptic(() => Haptics.selectionAsync());
  }, [sound, hapticsOn]);

  return { onGrab };
}
