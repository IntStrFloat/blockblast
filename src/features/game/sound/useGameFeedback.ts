import { useCallback, useEffect } from 'react';
import * as Haptics from 'expo-haptics';

import { useSettings } from '@/features/settings';

import { useGameStore } from '../store';
import { soundForPlacement } from './soundEvents';
import { initSounds, playSound } from './sounds';

function haptic(fn: () => Promise<void>): void {
  fn().catch(() => {});
}

/**
 * Maps PlacementEvent to sound + haptics.
 * Returns onGrab for DragCtx.
 */
export function useGameFeedback(): { onGrab: () => void } {
  const lastEvent = useGameStore((s) => s.lastEvent);
  const recordCelebration = useGameStore((s) => s.recordCelebration);
  const recordCelebrated = useGameStore((s) => s.recordCelebrated);
  const sound = useSettings((s) => s.sound);
  const hapticsOn = useSettings((s) => s.haptics);

  useEffect(() => {
    initSounds();
  }, []);

  // Placement feedback
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

  // One-shot record celebration for the active run.
  useEffect(() => {
    if (!recordCelebration || recordCelebrated) return;
    const timer = setTimeout(() => {
      if (sound) playSound('record');
      useGameStore.setState({ recordCelebrated: true });
    }, 600);
    return () => clearTimeout(timer);
  }, [recordCelebrated, recordCelebration, sound]);

  const onGrab = useCallback(() => {
    if (sound) playSound('pickup');
    if (hapticsOn) haptic(() => Haptics.selectionAsync());
  }, [sound, hapticsOn]);

  return { onGrab };
}
