import { useEffect, useLayoutEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '@/ui';

import {
  EFFECT_SEQUENCE_TIMING,
  highComboAuraIntensity,
} from '../animation/effectSequence';

interface ComboAuraFrameProps {
  combo: number;
  eventId: string | null;
  boardSize: number;
  color: string;
  reducedMotion: boolean;
}

function alphaColor(color: string, alpha: number) {
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) return `rgba(255,110,220,${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function ComboAuraFrame({
  combo,
  eventId,
  boardSize,
  color,
  reducedMotion,
}: ComboAuraFrameProps) {
  const intensity = highComboAuraIntensity(combo);
  const aura = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    aura.value = withTiming(intensity, {
      duration:
        intensity > 0
          ? reducedMotion
            ? 140
            : 220
          : EFFECT_SEQUENCE_TIMING.comboAuraFadeMs,
    });
  }, [aura, intensity, reducedMotion]);

  useLayoutEffect(() => {
    cancelAnimation(sweep);
    sweep.value = 0;
    if (eventId && intensity > 0 && !reducedMotion) {
      sweep.value = withDelay(
        EFFECT_SEQUENCE_TIMING.chargeStartMs,
        withTiming(1, {
          duration:
            EFFECT_SEQUENCE_TIMING.waveEndMs - EFFECT_SEQUENCE_TIMING.chargeStartMs,
          easing: Easing.linear,
        }),
      );
    }
    return () => cancelAnimation(sweep);
  }, [eventId, intensity, reducedMotion, sweep]);

  const frameStyle = useAnimatedStyle(() => ({
    opacity: aura.value,
    transform: [{ scale: 1 + aura.value * 0.008 }],
  }));
  const leftStreakStyle = useAnimatedStyle(() => ({
    opacity: aura.value * interpolate(sweep.value, [0, 0.16, 0.72, 1], [0, 1, 0.45, 0]),
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [-36, boardSize + 18]) }],
  }));
  const rightStreakStyle = useAnimatedStyle(() => ({
    opacity: aura.value * interpolate(sweep.value, [0, 0.32, 0.86, 1], [0, 0.42, 1, 0]),
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [boardSize + 18, -36]) }],
  }));
  const topStreakStyle = useAnimatedStyle(() => ({
    opacity: aura.value * interpolate(sweep.value, [0, 0.24, 0.68, 1], [0, 0.5, 1, 0]),
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-42, boardSize + 18]) }],
  }));

  return (
    <>
      <Animated.View
        testID="combo-aura-frame"
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: -7,
            top: -7,
            right: -7,
            bottom: -7,
            borderRadius: radii.card / 2 + 7,
            borderWidth: combo >= 10 ? 4 : 3,
            borderColor: alphaColor(combo >= 10 ? '#FF57D9' : color, combo >= 10 ? 0.88 : 0.68),
            backgroundColor: alphaColor(combo >= 10 ? '#A83CFF' : color, combo >= 10 ? 0.09 : 0.045),
            shadowColor: combo >= 10 ? '#FF3CCB' : color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: combo >= 10 ? 0.92 : 0.64,
            shadowRadius: combo >= 10 ? 13 : 8,
            elevation: combo >= 10 ? 8 : 5,
            opacity: 0,
          },
          frameStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: -5,
            top: 0,
            width: 4,
            height: 30,
            borderRadius: 3,
            backgroundColor: '#7EF3FF',
            shadowColor: '#5BE8FF',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 7,
            elevation: 7,
          },
          leftStreakStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            right: -5,
            top: 0,
            width: 4,
            height: 30,
            borderRadius: 3,
            backgroundColor: '#FF7CE4',
            shadowColor: '#FF4FD7',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 7,
            elevation: 7,
          },
          rightStreakStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            top: -5,
            width: 34,
            height: 4,
            borderRadius: 3,
            backgroundColor: '#FFF080',
            shadowColor: '#FFD83D',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 7,
            elevation: 7,
          },
          topStreakStyle,
        ]}
      />
    </>
  );
}
