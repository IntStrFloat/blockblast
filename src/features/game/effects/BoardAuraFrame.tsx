import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '@/ui';

import { ATMOSPHERE, atmospherePhaseForScore } from '../animation/atmosphere';
import { recordProgressFor, recordSceneIntensityFor } from '../animation/recordProgression';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useGameStore } from '../store';

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(255,255,255,${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

interface BoardAuraFrameProps {
  /** Акцент активной темы мира — цвет ауры. */
  accent: string;
  /** Первый juice-цвет темы — внутренняя кромка. */
  edge: string;
}

/**
 * Сигнатурный элемент «Разогрева»: аура-обводка доски, которой нет на старте.
 * Она проявляется с фазой атмосферы, с фазы breathFromPhase начинает «дышать»,
 * а на каждом фазапе даёт вспышку-свип. Кламп: только transform/opacity,
 * монтируется один раз, JS — по смене фазы (раз в сотни очков).
 */
export function BoardAuraFrame({ accent, edge }: BoardAuraFrameProps) {
  const score = useGameStore((s) => s.game.score);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const recordCelebration = useGameStore((s) => s.recordCelebration);
  const phase = atmospherePhaseForScore(score);
  const recordProgress = recordProgressFor(score, runBestAtStart);
  const recordIntensity = recordSceneIntensityFor(recordProgress.stage);
  const reducedMotion = useReducedMotion();

  const auraOpacity = useSharedValue(0);
  useEffect(() => {
    // Score phases keep their background atmosphere, but a persistent board
    // outline is reserved for records and the dedicated high-combo frame.
    const target = recordIntensity * 0.56;
    auraOpacity.value = withTiming(target, {
      duration: reducedMotion ? 250 : ATMOSPHERE.frameFadeMs,
    });
  }, [auraOpacity, recordIntensity, reducedMotion]);

  const breath = useSharedValue(0);
  const breathing =
    (phase >= ATMOSPHERE.breathFromPhase || recordProgress.stage === 'near') && !reducedMotion;
  useEffect(() => {
    if (breathing) {
      breath.value = withRepeat(
        withTiming(1, {
          duration: ATMOSPHERE.breathDurationMs,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      );
    } else {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(breath);
  }, [breath, breathing]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: auraOpacity.value * (1 - 0.22 * breath.value),
    transform: [
      {
        scale:
          1 +
          ((recordProgress.stage === 'near' ? 1.003 : 1.004) - 1) * breath.value,
      },
    ],
  }));

  // Вспышка-свип только на росте фазы после маунта: резюм сохранённой партии
  // с высоким счётом не должен «стрелять» на входе.
  const [sweepKey, setSweepKey] = useState<string | null>(null);
  const prevPhaseRef = useRef<number | null>(null);
  const handledRecordRef = useRef(recordCelebration);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prev !== null && phase > prev) setSweepKey(`phase-${phase}`);
  }, [phase]);
  useEffect(() => {
    if (!recordCelebration || handledRecordRef.current === recordCelebration) return;
    handledRecordRef.current = recordCelebration;
    setSweepKey(`record-${recordCelebration.score}`);
  }, [recordCelebration]);

  const sweepAnimation = new Keyframe(
    reducedMotion
      ? {
          0: { opacity: 0, transform: [{ scale: 1 }] },
          40: { opacity: 0.5, transform: [{ scale: 1 }] },
          100: { opacity: 0, transform: [{ scale: 1 }] },
        }
      : {
          0: { opacity: 0, transform: [{ scale: 0.99 }] },
          26: { opacity: 0.9, transform: [{ scale: 1.014 }] },
          100: { opacity: 0, transform: [{ scale: 1.03 }] },
        },
  ).duration(ATMOSPHERE.sweepDurationMs);

  return (
    <>
      <View
        testID="board-base-frame"
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -6,
          top: -6,
          right: -6,
          bottom: -6,
          borderRadius: 22,
          borderWidth: 3,
          borderColor: 'rgba(218,242,255,0.56)',
          shadowColor: '#0A3F9F',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.42,
          shadowRadius: 4,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: -7,
            top: -7,
            right: -7,
            bottom: -7,
            opacity: 0,
          },
          auraStyle,
        ]}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            borderRadius: radii.card / 2 + 6,
            borderWidth: 4,
            borderColor: hexToRgba(accent, 0.4),
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 5,
            top: 5,
            right: 5,
            bottom: 5,
            borderRadius: radii.card / 2 + 2,
            borderWidth: 1.5,
            borderColor: hexToRgba(edge, 0.8),
          }}
        />
      </Animated.View>
      {sweepKey ? (
        <Animated.View
          key={sweepKey}
          entering={sweepAnimation}
          pointerEvents="none"
          style={{
            opacity: 0,
            position: 'absolute',
            left: -7,
            top: -7,
            right: -7,
            bottom: -7,
            borderRadius: radii.card / 2 + 6,
            borderWidth: 3,
            borderColor: hexToRgba(accent, 0.85),
          }}
        />
      ) : null}
    </>
  );
}
