import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useReducer, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe } from 'react-native-reanimated';

import { useReducedMotion } from '../animation/useReducedMotion';
import { useGameStore } from '../store';

const SOFT_SUNSET = {
  base: '#0E1736',
  peach: '#F6B39F',
  pink: '#E98BAC',
  coolIndigo: '#425E9E',
  halo: '#A7D2FF',
  shadow: '#060A16',
} as const;

function hexToRgba(hex: string, alpha: number) {
  const cleaned = hex.replace('#', '');
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : cleaned;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

const WARM_PEACH = hexToRgba(SOFT_SUNSET.peach, 0.34);
const WARM_PEACH_FADE = hexToRgba(SOFT_SUNSET.peach, 0);
const WARM_PINK = hexToRgba(SOFT_SUNSET.pink, 0.28);
const WARM_PINK_FADE = hexToRgba(SOFT_SUNSET.pink, 0);
const COOL_INDIGO = hexToRgba(SOFT_SUNSET.coolIndigo, 0.30);
const COOL_INDIGO_FADE = hexToRgba(SOFT_SUNSET.coolIndigo, 0);
const COOL_HALO = hexToRgba(SOFT_SUNSET.halo, 0.16);
const COOL_HALO_FADE = hexToRgba(SOFT_SUNSET.halo, 0);
const VIGNETTE = hexToRgba(SOFT_SUNSET.shadow, 0.18);

interface GameBackgroundProps {
  boardSize: number;
  boardLayout?: { x: number; y: number; width: number; height: number } | null;
}

function buildPulseIn(reducedMotion: boolean) {
  return reducedMotion
    ? FadeIn.duration(120)
    : new Keyframe({
        0: { opacity: 0, transform: [{ scale: 0.985 }] },
        28: { opacity: 0.68, transform: [{ scale: 1.03 }] },
        62: { opacity: 0.5, transform: [{ scale: 1.012 }] },
        100: { opacity: 0, transform: [{ scale: 1.02 }] },
      }).duration(280);
}

function buildPulseOut(reducedMotion: boolean) {
  return reducedMotion
    ? FadeOut.duration(100)
    : new Keyframe({
        0: { opacity: 0.5, transform: [{ scale: 1.012 }] },
        100: { opacity: 0, transform: [{ scale: 1 }] },
      }).duration(140);
}

export function GameBackground({ boardSize, boardLayout }: GameBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const lastEvent = useGameStore((state) => state.lastEvent);
  const reducedMotion = useReducedMotion();
  const [pulseToken, setPulseToken] = useState<string | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sessionNonce, bumpSessionNonce] = useReducer((current: number) => current + 1, 0);
  const pulseSessionArmedRef = useRef(false);
  const activeEventToken =
    lastEvent && lastEvent.scoreDelta > 0 && lastEvent.combo >= 2
      ? `${sessionNonce}:${lastEvent.score}`
      : null;
  const pulseVisible = pulseToken !== null && pulseToken === activeEventToken;

  useEffect(() => {
    const clearPulseTimer = () => {
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    if (!lastEvent || lastEvent.scoreDelta <= 0 || lastEvent.combo < 2) {
      if (pulseSessionArmedRef.current) {
        pulseSessionArmedRef.current = false;
        bumpSessionNonce();
      }
      clearPulseTimer();
      return clearPulseTimer;
    }

    pulseSessionArmedRef.current = true;
    const eventToken = `${sessionNonce}:${lastEvent.score}`;
    clearPulseTimer();
    startTimerRef.current = setTimeout(() => {
      setPulseToken(eventToken);
      hideTimerRef.current = setTimeout(() => {
        setPulseToken((current) => (current === eventToken ? null : current));
        hideTimerRef.current = null;
      }, reducedMotion ? 220 : 300);
      startTimerRef.current = null;
    }, 0);

    return clearPulseTimer;
  }, [lastEvent, reducedMotion, sessionNonce]);

  const haloWidth = boardSize * 1.74;
  const haloHeight = boardSize * 1.18;
  const boardAnchor = boardLayout
    ? {
        x: boardLayout.x + boardLayout.width / 2,
        y: boardLayout.y + boardLayout.height / 2,
      }
    : {
        x: width / 2,
        y: Math.max(height * 0.31, boardSize * 0.82),
      };
  const haloLeft = boardAnchor.x - haloWidth / 2;
  const haloTop = boardAnchor.y - haloHeight / 2;

  const pulseIn = buildPulseIn(reducedMotion);
  const pulseOut = buildPulseOut(reducedMotion);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: SOFT_SUNSET.base }]} />

      <LinearGradient
        colors={[WARM_PEACH, WARM_PEACH_FADE]}
        start={{ x: 0.1, y: 0.08 }}
        end={{ x: 0.7, y: 0.68 }}
        style={[
          styles.glow,
          {
            top: -height * 0.06,
            left: -width * 0.12,
            width: width * 0.88,
            height: height * 0.46,
            borderRadius: width,
            opacity: 0.96,
          },
        ]}
      />

      <LinearGradient
        colors={[WARM_PINK, WARM_PINK_FADE]}
        start={{ x: 0.85, y: 0 }}
        end={{ x: 0.2, y: 0.74 }}
        style={[
          styles.glow,
          {
            top: height * 0.02,
            right: -width * 0.1,
            width: width * 0.72,
            height: height * 0.38,
            borderRadius: width,
            opacity: 0.88,
          },
        ]}
      />

      <LinearGradient
        colors={[COOL_INDIGO, COOL_INDIGO_FADE]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.96 }}
        style={[
          styles.glow,
          {
            bottom: -height * 0.1,
            left: -width * 0.12,
            width: width * 1.12,
            height: height * 0.42,
            borderRadius: width,
            opacity: 0.84,
          },
        ]}
      />

      <LinearGradient
        colors={[COOL_HALO, COOL_HALO_FADE]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.glow,
          {
            left: haloLeft,
            top: haloTop,
            width: haloWidth,
            height: haloHeight,
            borderRadius: haloWidth,
            opacity: 0.85,
          },
        ]}
      />

      <View style={[StyleSheet.absoluteFill, { backgroundColor: VIGNETTE }]} />

      {pulseVisible ? (
        <Animated.View
          key={pulseToken}
          entering={pulseIn}
          exiting={pulseOut}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.pulseShell]}
        >
          <LinearGradient
            colors={['rgba(255,232,216,0.16)', 'rgba(255,232,216,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              styles.pulseCore,
              {
                width: haloWidth * 0.92,
                height: haloHeight * 0.78,
                borderRadius: haloWidth,
              },
            ]}
          />
          <LinearGradient
            colors={['rgba(255,190,163,0.12)', 'rgba(255,190,163,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.pulseCore,
              {
                width: haloWidth * 0.78,
                height: haloHeight * 0.66,
                borderRadius: haloWidth,
              },
            ]}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
  },
  pulseShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCore: {
    position: 'absolute',
    opacity: 1,
  },
});
