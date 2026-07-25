import { useEffect, useRef, useState } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { atmosphereText } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { AppText, radii } from '@/ui';

import { ATMOSPHERE, atmospherePhaseForScore } from '../animation/atmosphere';
import { useGameStore } from '../store';

/**
 * Тост смены фазы атмосферы: короткое имя фазы в тоне игрока («Разогрев!» /
 * «пошла жара»). Показывается только на росте фазы после маунта — резюм партии
 * с высоким счётом тост не даёт. Низкочастотный React-путь, вне drag.
 */
export function AtmosphereToast() {
  const score = useGameStore((s) => s.game.score);
  const recordCelebration = useGameStore((s) => s.recordCelebration);
  const phase = atmospherePhaseForScore(score);
  const tone = useSettings((s) => s.praiseTone);
  const lang = useLang();
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const prevPhaseRef = useRef<number | null>(null);
  const counter = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id, text });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (counter.current === id) setToast(null);
    }, ATMOSPHERE.toastDurationMs);
  }, [lang, phase, recordCelebration, score, tone]);

  if (!toast) return null;

  return (
    <Animated.View
      key={toast.id}
      testID="atmosphere-toast"
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(240)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '13%',
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
      <AppText preset="button">{toast.text}</AppText>
    </Animated.View>
  );
}
