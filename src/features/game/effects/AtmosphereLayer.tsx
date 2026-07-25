import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  ATMOSPHERE,
  atmospherePhaseForScore,
  moteLayout,
  motesForPhase,
} from '../animation/atmosphere';
import {
  recordMoteBonusFor,
  recordProgressFor,
  recordSceneIntensityFor,
} from '../animation/recordProgression';
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

interface MoteProps {
  index: number;
  color: string;
  active: boolean;
  screenWidth: number;
  screenHeight: number;
}

/**
 * Одна эмбиент-искра: луп подъёма+мерцания целиком на UI-потоке. JS участвует
 * только в старте/остановке лупа при смене фазы (редкое событие, вне drag-пути).
 */
const Mote = memo(function Mote({ index, color, active, screenWidth, screenHeight }: MoteProps) {
  const { x, y, size, durationMs, delayMs } = moteLayout(index, screenWidth, screenHeight);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = withDelay(
        delayMs,
        withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false),
      );
    } else {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 400 });
    }
    return () => cancelAnimation(progress);
  }, [active, delayMs, durationMs, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(
        p,
        [0, 0.18, 0.7, 1],
        [0, ATMOSPHERE.moteOpacityMax, ATMOSPHERE.moteOpacityMax * 0.65, 0],
      ),
      transform: [{ translateY: interpolate(p, [0, 1], [0, -ATMOSPHERE.moteDriftPx]) }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
          opacity: 0,
        },
        style,
      ]}
    />
  );
});

interface AtmosphereLayerProps {
  /** Цвета juice активной темы мира — аврора и искры в сеттинге мира. */
  glowColors: readonly string[];
  /** Акцент темы — тёплая часть авроры. */
  accent: string;
}

/**
 * Эволюция сцены по фазе атмосферы: дополнительная аврора фона (кроссфейд по
 * фазе) + фикс-пул эмбиент-искр. Пул монтируется один раз; фаза меняется не
 * чаще раза в ход, всё анимируемое — transform/opacity (спека 07).
 */
export function AtmosphereLayer({ glowColors, accent }: AtmosphereLayerProps) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const score = useGameStore((s) => s.game.score);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const phase = atmospherePhaseForScore(score);
  const recordProgress = recordProgressFor(score, runBestAtStart);
  const recordIntensity = recordSceneIntensityFor(recordProgress.stage);

  const auroraOpacity = useSharedValue(0);
  useEffect(() => {
    const target = Math.min(
      0.64,
      (ATMOSPHERE.auroraOpacityPerPhase[phase] ?? 0) + recordIntensity * 0.12,
    );
    auroraOpacity.value = withTiming(target, {
      duration: reducedMotion ? 300 : ATMOSPHERE.auroraFadeMs,
    });
  }, [auroraOpacity, phase, recordIntensity, reducedMotion]);
  const auroraStyle = useAnimatedStyle(() => ({ opacity: auroraOpacity.value }));

  const auroraA = glowColors[1] ?? accent;
  const auroraB = glowColors[2] ?? glowColors[0] ?? accent;
  const moteColor = glowColors[0] ?? accent;
  const visibleMotes = Math.min(
    ATMOSPHERE.motePoolSize,
    motesForPhase(phase) + recordMoteBonusFor(recordProgress.stage),
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, auroraStyle]}>
        <LinearGradient
          colors={[hexToRgba(auroraA, 0.3), hexToRgba(auroraA, 0)]}
          start={{ x: 0, y: 0.85 }}
          end={{ x: 0.8, y: 0.1 }}
          style={[
            styles.aurora,
            {
              left: -width * 0.2,
              bottom: height * 0.18,
              width: width * 0.9,
              height: height * 0.5,
              borderRadius: width,
            },
          ]}
        />
        <LinearGradient
          colors={[hexToRgba(auroraB, 0.26), hexToRgba(auroraB, 0)]}
          start={{ x: 1, y: 0.7 }}
          end={{ x: 0.15, y: 0 }}
          style={[
            styles.aurora,
            {
              right: -width * 0.24,
              top: height * 0.08,
              width: width * 0.94,
              height: height * 0.46,
              borderRadius: width,
            },
          ]}
        />
      </Animated.View>

      {reducedMotion
        ? null
        : Array.from({ length: ATMOSPHERE.motePoolSize }, (_, index) => (
            <Mote
              key={index}
              index={index}
              color={moteColor}
              active={index < visibleMotes}
              screenWidth={width}
              screenHeight={height}
            />
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  aurora: {
    position: 'absolute',
  },
});
