import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut, Keyframe } from "react-native-reanimated";

import { useReducedMotion } from "../animation/useReducedMotion";
import { useGameStore } from "../store";

function hexToRgba(hex: string, alpha: number) {
  const cleaned = hex.replace("#", "");
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : cleaned;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

interface GameBackgroundProps {
  boardSize: number;
  boardLayout?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  /** Светлый верх фона активной темы мира (спека 12 §3). */
  bgTop: string;
  /** Тёмная база фона активной темы мира. */
  bgBottom: string;
  /** Цвета juice/частиц темы — задают атмосферу свечений. */
  glowColors: readonly string[];
  /** Акцент темы (похвалы) — цвет ореола и комбо-пульса. */
  haloColor: string;
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

export function GameBackground({
  boardSize,
  boardLayout,
  bgTop,
  bgBottom,
  glowColors,
  haloColor,
}: GameBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const lastEvent = useGameStore((state) => state.lastEvent);
  const reducedMotion = useReducedMotion();

  // Палитра свечений выводится из активной темы мира: каждый мир — свой сеттинг
  // (фон + атмосфера), а не хардкод. Структура слоёв и прозрачности сохранены.
  const palette = useMemo(() => {
    const warmA = glowColors[0] ?? bgTop;
    const warmB = glowColors[1] ?? glowColors[0] ?? bgTop;
    const cool = bgTop;
    const halo = haloColor;
    return {
      base: bgBottom,
      warmA: hexToRgba(warmA, 0.34),
      warmAFade: hexToRgba(warmA, 0),
      warmB: hexToRgba(warmB, 0.28),
      warmBFade: hexToRgba(warmB, 0),
      cool: hexToRgba(cool, 0.3),
      coolFade: hexToRgba(cool, 0),
      halo: hexToRgba(halo, 0.16),
      haloFade: hexToRgba(halo, 0),
      vignette: hexToRgba(bgBottom, 0.4),
      pulseCore: hexToRgba(halo, 0.16),
      pulseCoreFade: hexToRgba(halo, 0),
      pulseEdge: hexToRgba(warmA, 0.12),
      pulseEdgeFade: hexToRgba(warmA, 0),
    };
  }, [bgBottom, bgTop, glowColors, haloColor]);
  const [pulseKey, setPulseKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseVisible = pulseKey > 0 && lastEvent?.score === pulseKey;

  useEffect(() => {
    const clearPulseTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!lastEvent || lastEvent.scoreDelta <= 0 || lastEvent.combo < 2) {
      clearPulseTimer();
      return clearPulseTimer;
    }

    const eventKey = lastEvent.score;
    clearPulseTimer();
    timerRef.current = setTimeout(() => {
      setPulseKey(eventKey);
      timerRef.current = setTimeout(
        () => {
          setPulseKey((current) => (current === eventKey ? 0 : current));
          timerRef.current = null;
        },
        reducedMotion ? 220 : 300,
      );
    }, 0);

    return clearPulseTimer;
  }, [lastEvent, reducedMotion]);

  const haloWidth = boardSize * 1.74;
  const haloHeight = boardSize * 1.18;
  const haloLeft = (width - haloWidth) / 2;
  const boardCenterY = boardLayout ? boardLayout.y + boardLayout.height / 2 : null;
  const haloTop =
    (boardCenterY ?? Math.max(height * 0.31, boardSize * 0.82)) - haloHeight / 2;

  const pulseIn = buildPulseIn(reducedMotion);
  const pulseOut = buildPulseOut(reducedMotion);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: palette.base }]}
      />

      <LinearGradient
        colors={[palette.warmA, palette.warmAFade]}
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
        colors={[palette.warmB, palette.warmBFade]}
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
        colors={[palette.cool, palette.coolFade]}
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
        colors={[palette.halo, palette.haloFade]}
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

      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.vignette }]} />

      {pulseVisible ? (
        <Animated.View
          key={pulseKey}
          entering={pulseIn}
          exiting={pulseOut}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.pulseShell]}
        >
          <LinearGradient
            colors={[palette.pulseCore, palette.pulseCoreFade]}
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
            colors={[palette.pulseEdge, palette.pulseEdgeFade]}
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
    position: "absolute",
  },
  pulseShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulseCore: {
    position: "absolute",
    opacity: 1,
  },
});
