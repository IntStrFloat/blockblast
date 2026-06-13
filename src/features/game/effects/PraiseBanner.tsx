import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { fireText, praiseText, t } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { AppText, radii } from '@/ui';

import { buildClearPresentation } from '../animation/clearPresentation';
import { SPECTACLE_MOTION } from '../animation/motion';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useDragCtx } from '../drag/DragContext';
import { useGameStore } from '../store';

const PRAISE_GRADIENT = ['#FF4D8D', '#FFB83D', '#FFF27A', '#5DFFB2', '#4DD8FF', '#B36BFF'] as const;

interface Banner {
  id: number;
  text: string | null;
  comboText: string | null;
  scoreDelta: number;
  centroid: { x: number; y: number };
  fontSize: number;
  reducedMotion: boolean;
}

interface LayeredPraiseProps {
  text: string;
  fontSize: number;
  boardSize: number;
}

function LayeredPraise({ text, fontSize, boardSize }: LayeredPraiseProps) {
  const textStyle = {
    position: 'absolute' as const,
    left: boardSize * 0.035,
    right: boardSize * 0.035,
    textAlign: 'center' as const,
    fontSize,
    lineHeight: Math.round(fontSize * 1.28),
  };
  const height = Math.round(fontSize * 1.6);

  return (
    <View style={{ width: boardSize, height, justifyContent: 'center' }}>
      <LinearGradient
        colors={PRAISE_GRADIENT}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: 'absolute',
          left: boardSize * 0.06,
          right: boardSize * 0.06,
          top: height * 0.18,
          bottom: height * 0.12,
          borderRadius: 999,
          opacity: 0.24,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: boardSize * 0.1,
          right: boardSize * 0.1,
          top: height * 0.24,
          bottom: height * 0.18,
          borderRadius: 999,
          backgroundColor: 'rgba(24,14,65,0.82)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.7)',
        }}
      />

      {[
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
        [0, 3],
      ].map(([x, y]) => (
        <AppText
          key={`${x}-${y}`}
          preset="title"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.62}
          style={{
            ...textStyle,
            color: '#3A145D',
            transform: [{ translateX: x }, { translateY: y }],
          }}
        >
          {text}
        </AppText>
      ))}

      <AppText
        preset="title"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.62}
        style={{
          ...textStyle,
          color: '#FF7CEB',
          opacity: 0.68,
          textShadowColor: '#B96CFF',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 18,
        }}
      >
        {text}
      </AppText>
      <AppText
        preset="title"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.62}
        style={{
          ...textStyle,
          color: '#FFE36A',
          textShadowColor: 'rgba(0,0,0,0.55)',
          textShadowOffset: { width: 0, height: 3 },
          textShadowRadius: 5,
        }}
      >
        {text}
      </AppText>
      <AppText
        preset="title"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.62}
        style={{
          ...textStyle,
          color: '#FFFFFF',
          opacity: 0.48,
          transform: [{ translateY: -1 }],
        }}
      >
        {text}
      </AppText>
    </View>
  );
}

export function PraiseBanner() {
  const ctx = useDragCtx();
  const lastEvent = useGameStore((state) => state.lastEvent);
  const tone = useSettings((state) => state.praiseTone);
  const lang = useLang();
  const reducedMotion = useReducedMotion();
  const [banner, setBanner] = useState<Banner | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!lastEvent || lastEvent.clearedCells.length === 0) return;
    const presentation = buildClearPresentation(
      lastEvent,
      ctx.geom,
      ctx.cellColors,
      reducedMotion,
    );
    const id = ++counter.current;
    const comboText =
      lastEvent.combo >= 2
        ? lastEvent.onFire
          ? fireText(tone, lang, lastEvent.combo)
          : `${t('game.combo', lang)} ×${lastEvent.combo}`
        : null;
    setBanner({
      id,
      text:
        lastEvent.praise === 'none'
          ? null
          : praiseText(lastEvent.praise, tone, lang),
      comboText,
      scoreDelta: lastEvent.scoreDelta,
      centroid: presentation.centroid,
      fontSize: presentation.praiseFontSize,
      reducedMotion,
    });
    const timer = setTimeout(() => {
      if (counter.current === id) setBanner(null);
    }, SPECTACLE_MOTION.praiseEndMs + 80);
    return () => clearTimeout(timer);
  }, [ctx.cellColors, ctx.geom, lang, lastEvent, reducedMotion, tone]);

  if (!banner) return null;

  const praiseAnimation = new Keyframe(
    banner.reducedMotion
      ? {
          0: { opacity: 0, transform: [{ scale: 0.94 }] },
          32: { opacity: 1, transform: [{ scale: 1 }] },
          76: { opacity: 1, transform: [{ scale: 1 }] },
          100: { opacity: 0, transform: [{ scale: 0.98 }] },
        }
      : {
          0: {
            opacity: 0,
            transform: [{ scale: 0.42 }, { translateY: 12 }, { rotate: '-3deg' }],
          },
          23: {
            opacity: 1,
            transform: [{ scale: 1.14 }, { translateY: -2 }, { rotate: '1deg' }],
          },
          38: {
            opacity: 1,
            transform: [{ scale: 0.98 }, { translateY: 0 }, { rotate: '0deg' }],
          },
          72: {
            opacity: 1,
            transform: [{ scale: 1.02 }, { translateY: -5 }, { rotate: '0deg' }],
          },
          100: {
            opacity: 0,
            transform: [{ scale: 1.08 }, { translateY: -30 }, { rotate: '0deg' }],
          },
        },
  )
    .duration(banner.reducedMotion ? 330 : 565)
    .delay(banner.reducedMotion ? 80 : SPECTACLE_MOTION.praiseStartMs);

  const scoreAnimation = new Keyframe(
    banner.reducedMotion
      ? {
          0: { opacity: 0, transform: [{ scale: 0.9 }] },
          35: { opacity: 1, transform: [{ scale: 1 }] },
          100: { opacity: 0, transform: [{ scale: 1 }] },
        }
      : {
          0: { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.55 }] },
          24: { opacity: 1, transform: [{ translateY: -8 }, { scale: 1.16 }] },
          46: { opacity: 1, transform: [{ translateY: -18 }, { scale: 1 }] },
          100: {
            opacity: 0,
            transform: [{ translateY: -ctx.geom.boardSize * 0.28 }, { scale: 0.86 }],
          },
        },
  )
    .duration(banner.reducedMotion ? 260 : 520)
    .delay(banner.reducedMotion ? 40 : 175);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: ctx.geom.boardSize,
        height: ctx.geom.boardSize,
      }}
    >
      <Animated.View
        key={`score-${banner.id}`}
        entering={scoreAnimation}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: banner.centroid.y - 16,
          alignItems: 'center',
        }}
      >
        <AppText
          preset="button"
          style={{
            fontSize: Math.max(16, Math.round(banner.fontSize * 0.58)),
            color: '#FFFFFF',
            textShadowColor: '#4DD8FF',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 12,
          }}
        >
          +{banner.scoreDelta}
        </AppText>
      </Animated.View>

      {banner.text ? (
        <Animated.View
          key={`praise-${banner.id}`}
          entering={praiseAnimation}
          style={{
            position: 'absolute',
            left: 0,
            top: ctx.geom.boardSize * 0.2,
            width: ctx.geom.boardSize,
            alignItems: 'center',
          }}
        >
          <LayeredPraise
            text={banner.text}
            fontSize={banner.fontSize}
            boardSize={ctx.geom.boardSize}
          />
          {banner.comboText ? (
            <View
              style={{
                marginTop: 3,
                borderRadius: radii.button,
                paddingHorizontal: 12,
                paddingVertical: 5,
                backgroundColor: 'rgba(20,12,54,0.88)',
                borderWidth: 1,
                borderColor: 'rgba(255,227,106,0.8)',
              }}
            >
              <AppText preset="caption" style={{ color: '#FFE36A' }}>
                {banner.comboText}
              </AppText>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
