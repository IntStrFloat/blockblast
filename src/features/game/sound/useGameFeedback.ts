import { useCallback, useEffect, useRef } from 'react';

import type { PlacementEvent } from '@/core/engine';
import { useSettings } from '@/features/settings';

import { useGameStore, type RecordCelebration } from '../store';
import {
  playGrabFeedback,
  playInvalidDropFeedback,
  playPlacementFeedback,
  playRecordFeedback,
} from './feedback';
import { RECORD_PROGRESS } from '../animation/recordProgression';
import { initSounds } from './sounds';

/**
 * Maps PlacementEvent to sound + haptics.
 * Returns onGrab and onInvalidDrop for DragCtx.
 */
export function useGameFeedback(): { onGrab: () => void; onInvalidDrop: () => void } {
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

    if (!sound && !hapticsOn && recordTimerRef.current) {
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
      playPlacementFeedback(event, {
        sound: soundRef.current,
        haptics: hapticsRef.current,
      });
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

    if (!soundRef.current && !hapticsRef.current) return;

    recordTimerRef.current = setTimeout(() => {
      recordTimerRef.current = null;
      playRecordFeedback({
        sound: soundRef.current,
        haptics: hapticsRef.current,
      });
    }, RECORD_PROGRESS.recordSoundDelayMs);

    return () => {
      if (!recordTimerRef.current) return;
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    };
  }, [recordCelebration]);

  const onGrab = useCallback(() => {
    const settings = useSettings.getState();
    playGrabFeedback({
      sound: settings.sound,
      haptics: settings.haptics,
    });
  }, []);

  const onInvalidDrop = useCallback(() => {
    const settings = useSettings.getState();
    playInvalidDropFeedback({
      sound: settings.sound,
      haptics: settings.haptics,
    });
  }, []);

  return { onGrab, onInvalidDrop };
}
