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

  // Звук/хаптику по ходу шлём через СИНХРОННУЮ подписку на стор, а не через
  // useEffect([lastEvent]). useEffect сработал бы только после тяжёлого ре-рендера
  // доски (buildClearPresentation, монтирование частиц) + commit + paint, из-за чего
  // звук ощутимо запаздывал относительно дропа. Подписка Zustand вызывается
  // синхронно внутри set() — до ре-рендера React, поэтому play() уходит в нативный
  // аудиопоток сразу, не дожидаясь отрисовки эффектов. One-shot на ссылку события.
  useEffect(() => {
    const handlePlacement = (event: PlacementEvent) => {
      if (handledPlacementEventRef.current === event) return;
      handledPlacementEventRef.current = event;

      const lines = event.clearedRows.length + event.clearedCols.length;

      if (soundRef.current) playSound(soundForPlacement(event));

      if (hapticsRef.current) {
        if (event.gameOver) {
          haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
        } else if (lines >= 3 || event.onFire) {
          haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        } else if (lines === 2) {
          haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
        } else if (lines === 1) {
          haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
        } else {
          haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
        }
      }
    };

    // Если экран смонтировался уже после хода — проиграть текущее событие один раз.
    const initial = useGameStore.getState().lastEvent;
    if (initial) handlePlacement(initial);

    return useGameStore.subscribe((state) => {
      if (state.lastEvent) handlePlacement(state.lastEvent);
    });
  }, []);

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
