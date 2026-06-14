import { useCallback, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

import type { PlacementEvent } from '@/core/engine';
import { useSettings } from '@/features/settings';

import { useGameStore, type RecordCelebration } from '../store';
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
  const sound = useSettings((s) => s.sound);
  const hapticsOn = useSettings((s) => s.haptics);

  const soundRef = useRef(sound);
  const hapticsRef = useRef(hapticsOn);
  const handledPlacementEventRef = useRef<PlacementEvent | null>(null);
  const handledRecordCelebrationRef = useRef<RecordCelebration | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initSounds();
  }, []);

  useEffect(() => {
    soundRef.current = sound;
    hapticsRef.current = hapticsOn;

    if (!sound && recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, [hapticsOn, sound]);

  // Placement feedback is one-shot per event reference.
  useEffect(() => {
    if (!lastEvent || handledPlacementEventRef.current === lastEvent) return;
    handledPlacementEventRef.current = lastEvent;

    const lines = lastEvent.clearedRows.length + lastEvent.clearedCols.length;

    if (soundRef.current) playSound(soundForPlacement(lastEvent));

    if (hapticsRef.current) {
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
  }, [lastEvent]);

  // One-shot record celebration for the active run.
  useEffect(() => {
    if (
      !recordCelebration ||
      recordCelebration === handledRecordCelebrationRef.current ||
      useGameStore.getState().recordCelebrated
    ) {
      return;
    }

    handledRecordCelebrationRef.current = recordCelebration;
    useGameStore.setState({ recordCelebrated: true });

    if (!soundRef.current) return;

    recordTimerRef.current = setTimeout(() => {
      recordTimerRef.current = null;
      if (soundRef.current) playSound('record');
    }, 600);

    return () => {
      if (!recordTimerRef.current) return;
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    };
  }, [recordCelebration]);

  const onGrab = useCallback(() => {
    if (soundRef.current) playSound('pickup');
    if (hapticsRef.current) haptic(() => Haptics.selectionAsync());
  }, []);

  return { onGrab };
}
