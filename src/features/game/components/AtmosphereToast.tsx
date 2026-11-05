import { useEffect, useRef, useState } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { atmosphereText } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { AppText, radii } from '@/ui';

import { ATMOSPHERE, atmospherePhaseForScore } from '../animation/atmosphere';
import { EFFECT_SEQUENCE_TIMING } from '../animation/effectSequence';
import { useGameStore } from '../store';

/**
 * Тост смены фазы атмосферы: короткое имя фазы в тоне игрока («Разогрев!» /
 * «пошла жара»). Показывается только на росте фазы после маунта — резюм партии
 * с высоким счётом тост не даёт. Низкочастотный React-путь, вне drag.
 */
export function AtmosphereToast({ hidden = false, onVisibleChange }: { hidden?: boolean; onVisibleChange?: (visible: boolean) => void }) {
  const score = useGameStore((s) => s.game.score);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const recordCelebration = useGameStore((s) => s.recordCelebration);
  const phase = atmospherePhaseForScore(score);
  const tone = useSettings((s) => s.praiseTone);
  const lang = useLang();
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const prevPhaseRef = useRef<number | null>(null);
  const counter = useRef(0);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prev === null || phase <= prev) return;
    if (recordCelebration?.score === score) return;
    const text = atmosphereText(phase, tone, lang);
    if (!text) return;
    const id = ++counter.current;
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    const show = () => {
      showTimerRef.current = null;
      setToast({ id, text });
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        if (counter.current === id) setToast(null);
      }, ATMOSPHERE.toastDurationMs);
    };
    const heroClearActive =
      lastEvent?.score === score && lastEvent.clearedCells.length > 0;
    if (heroClearActive) {
      showTimerRef.current = setTimeout(
        show,
        EFFECT_SEQUENCE_TIMING.celebrationEndMs + 80,
      );
    } else {
      show();
    }
  }, [lang, lastEvent, phase, recordCelebration, score, tone]);

  useEffect(() => {
    onVisibleChange?.(toast !== null && !hidden);
    return () => onVisibleChange?.(false);
  }, [hidden, onVisibleChange, toast]);

  if (!toast || hidden) return null;

  return (
    <Animated.View
      key={toast.id}
      testID="atmosphere-toast"
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(240)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        maxWidth: '100%',
        alignSelf: 'center',
        backgroundColor: 'rgba(16,22,46,0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        borderRadius: radii.button,
        paddingHorizontal: 16,
        paddingVertical: 7,
        zIndex: 55,
      }}
    >
      <AppText preset="button" numberOfLines={2} maxFontSizeMultiplier={1.2} style={{ fontSize: 12, lineHeight: 16, includeFontPadding: false, textAlign: 'center' }}>{toast.text}</AppText>
    </Animated.View>
  );
}
