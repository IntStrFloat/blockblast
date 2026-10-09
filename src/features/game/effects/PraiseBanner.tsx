import { useLayoutEffect, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Keyframe,
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { PlacementEvent, PraiseTier } from '@/core/engine';
import { praiseText, t } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { AppText } from '@/ui';

import { praiseFontSize } from '../animation/clearPresentation';
import {
  comboCelebrationFor,
  type ComboCelebrationPresentation,
  type ComboParticlePresentation,
} from '../animation/comboCelebration';
import { SPECTACLE_MOTION } from '../animation/motion';
import { centroid } from '../animation/presentationMath';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useDragCtx } from '../drag/DragContext';
import { useGameStore } from '../store';

const PRAISE_ENTER_MS = 520;
const PRAISE_REDUCED_ENTER_MS = 240;
const SCORE_ENTER_MS = 360;
const SCORE_REDUCED_ENTER_MS = 210;

const LETTER_FONT = 'Fredoka_700Bold';
const OUTLINE_COLOR = '#0C1730';
const FILL_COLOR = '#FFF6E4';
const COMBO_LABEL = {
  fill: '#F6FBFF',
  outline: '#2988FF',
  depth: '#07388D',
  glow: 'rgba(68,187,255,0.98)',
} as const;
const COMBO_NUMBER = {
  fill: '#FFE55C',
  outline: '#FF991F',
  depth: '#A5450C',
  glow: 'rgba(255,205,55,1)',
} as const;

const TIER_STYLE: Record<
  Exclude<PraiseTier, 'none'>,
  { fill: string; outline: string; depth: string; glow: string }
> = {
  good: {
    fill: '#F4FCFF',
    outline: '#2AB8F2',
    depth: '#0871B5',
    glow: 'rgba(82,220,255,0.98)',
  },
  great: {
    fill: '#FFF5A8',
    outline: '#FFAD2F',
    depth: '#B84A14',
    glow: 'rgba(255,205,73,1)',
  },
  amazing: {
    fill: '#FFE35A',
    outline: '#FF8426',
    depth: '#A83A17',
    glow: 'rgba(255,178,43,1)',
  },
  unbelievable: {
    fill: '#FFF8D7',
    outline: '#FF5267',
    depth: '#9D2048',
    glow: 'rgba(255,99,126,1)',
  },
};

interface Banner {
  id: number;
  text: string | null;
  tier: PraiseTier;
  combo: number | null;
  scoreDelta: number;
  centroid: { x: number; y: number };
  fontSize: number;
  reducedMotion: boolean;
}

interface LetteringProps {
  text: string;
  fontSize: number;
  width: number;
  glow: string;
  variant: 'praise' | 'combo' | 'number';
  fill: string;
  outline: string;
  depthColor: string;
}

const praiseEventIds = new WeakMap<PlacementEvent, number>();
let nextPraiseEventId = 1;

function praiseEventId(event: PlacementEvent) {
  let id = praiseEventIds.get(event);
  if (!id) {
    id = nextPraiseEventId++;
    praiseEventIds.set(event, id);
  }
  return id;
}

function FeedbackMotion({
  variant,
  reducedMotion,
  boardSize,
  entranceScale = 1.08,
  style,
  testID,
  children,
}: {
  variant: 'score' | 'praise';
  reducedMotion: boolean;
  boardSize: number;
  entranceScale?: number;
  style: ViewStyle;
  testID: string;
  children: ReactNode;
}) {
  // One owner for opacity, from the first committed frame through retirement.
  // A layout entrance plus a separate hide timer could expose the resting text.
  const progress = useSharedValue(0);
  const isPraise = variant === 'praise';
  const duration = isPraise
    ? reducedMotion ? PRAISE_REDUCED_ENTER_MS : PRAISE_ENTER_MS
    : reducedMotion ? SCORE_REDUCED_ENTER_MS : SCORE_ENTER_MS;
  const delay = isPraise
    ? reducedMotion ? 70 : SPECTACLE_MOTION.praiseStartMs
    : reducedMotion ? 40 : 175;

  useLayoutEffect(() => {
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, {
      duration,
      easing: Easing.linear,
      // The reduced profile above still needs its brief opacity feedback.
      reduceMotion: ReduceMotion.Never,
    }), ReduceMotion.Never));
    return () => cancelAnimation(progress);
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (reducedMotion) {
      return {
        opacity: interpolate(p, [0, 0.28, 0.74, 1], [0, 1, 1, 0]),
        transform: [{ translateY: 0 }, { scale: 1 }],
      };
    }
    return isPraise ? {
      opacity: interpolate(p, [0, 0.18, 0.82, 1], [0, 1, 1, 0]),
      transform: [
        { translateY: interpolate(p, [0, 0.18, 0.82, 1], [4, 0, -3, -12]) },
        { scale: interpolate(p, [0, 0.18, 0.32, 1], [0.92, entranceScale, 1, 1]) },
      ],
    } : {
      opacity: interpolate(p, [0, 0.26, 0.5, 1], [0, 1, 1, 0]),
      transform: [
        { translateY: interpolate(p, [0, 0.26, 0.5, 1], [0, -8, -17, -boardSize * 0.2]) },
        { scale: interpolate(p, [0, 0.26, 0.5, 1], [0.9, 1.08, 1, 0.9]) },
      ],
    };
  });

  return (
    <Animated.View testID={testID} pointerEvents="none" style={[style, { opacity: 0 }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/**
 * Леттеринг в два слоя (никаких клип-масок с независимым автоскейлом, которые
 * могли «двоить»): тёмная копия-контур со смещением вниз даёт объём, светлая
 * копия сверху несёт цветное свечение тира. Оба слоя — один и тот же Text с
 * одинаковыми ограничениями, поэтому автоподбор кегля сходится к одному размеру.
 */
function Lettering({
  text,
  fontSize,
  width,
  glow,
  variant,
  fill,
  outline,
  depthColor,
}: LetteringProps) {
  const lineHeight = Math.round(fontSize * 1.22);
  const depth = Math.max(3, Math.round(fontSize * 0.11));
  const stroke = Math.max(2, Math.round(fontSize * 0.06));
  const fitProps = {
    numberOfLines: 1,
    adjustsFontSizeToFit: true,
    minimumFontScale: 0.55,
  } as const;
  const baseStyle = {
    textAlign: 'center' as const,
    // Fredoka has no Cyrillic glyphs; use the already bundled Cyrillic face.
    fontFamily: /[\u0400-\u04FF]/.test(text) ? 'Unbounded_700Bold' : LETTER_FONT,
    fontSize: variant === 'combo' && /[\u0400-\u04FF]/.test(text) ? Math.round(fontSize * 0.78) : fontSize,
    lineHeight,
    fontStyle: 'italic' as const,
    letterSpacing: variant === 'number' ? -1 : -0.2,
    paddingHorizontal: stroke + 8,
  };
  const outlineOffsets = [
    { left: -stroke * 0.72, top: -stroke * 0.72 },
    { left: stroke * 0.72, top: -stroke * 0.72 },
    { left: -stroke * 0.72, top: stroke * 0.72 },
    { left: stroke * 0.72, top: stroke * 0.72 },
  ];

  return (
    <View
      needsOffscreenAlphaCompositing
      renderToHardwareTextureAndroid
      style={{ width, height: lineHeight + depth + stroke * 2 }}
    >
      <AppText
        preset="title"
        {...fitProps}
        style={[
          baseStyle,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: depth + stroke,
            color: depthColor,
            textShadowColor: OUTLINE_COLOR,
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          },
        ]}
      >
        {text}
      </AppText>
      {outlineOffsets.map((offset, index) => (
        <AppText
          key={`${text}-outline-${index}`}
          preset="title"
          {...fitProps}
          style={[
            baseStyle,
            {
              position: 'absolute',
              left: offset.left,
              right: -offset.left,
              top: offset.top + stroke,
              color: outline,
            },
          ]}
        >
          {text}
        </AppText>
      ))}
      <AppText
        preset="title"
        {...fitProps}
        style={[
          baseStyle,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: stroke,
            color: fill,
            textShadowColor: glow,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 11,
          },
        ]}
      >
        {text}
      </AppText>
    </View>
  );
}

function ParticleShape({ particle }: { particle: ComboParticlePresentation }) {
  const size = particle.size;

  if (particle.kind === 'spark') {
    const thickness = Math.max(2, size * 0.22);
    return (
      <View style={{ width: size, height: size, transform: [{ rotate: `${particle.rotationDeg}deg` }] }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: (size - thickness) / 2,
            width: size,
            height: thickness,
            borderRadius: thickness / 2,
            backgroundColor: particle.color,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: (size - thickness) / 2,
            top: 0,
            width: thickness,
            height: size,
            borderRadius: thickness / 2,
            backgroundColor: particle.color,
          }}
        />
      </View>
    );
  }

  if (particle.kind === 'confetti') {
    return (
      <View
        style={{
          width: Math.max(3, size * 0.42),
          height: size * 1.35,
          borderRadius: size * 0.18,
          backgroundColor: particle.color,
          transform: [{ rotate: `${particle.rotationDeg}deg` }],
        }}
      />
    );
  }

  const isBlock = particle.kind === 'block';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: isBlock ? size * 0.22 : size * 0.08,
        borderWidth: isBlock ? Math.max(1, size * 0.1) : 0,
        borderColor: isBlock ? 'rgba(255,255,255,0.72)' : 'transparent',
        backgroundColor: particle.color,
        boxShadow: `0 0 ${Math.max(4, size * 0.8)}px ${particle.color}`,
        transform: [{ rotate: `${isBlock ? particle.rotationDeg : 45}deg` }],
      }}
    />
  );
}

function CelebrationBurst({
  boardSize,
  presentation,
}: {
  boardSize: number;
  presentation: ComboCelebrationPresentation;
}) {
  if (presentation.rays.length === 0 && presentation.particles.length === 0) return null;

  const height = boardSize * 0.2;
  const centerX = boardSize / 2;
  const centerY = height * 0.47;

  return (
    <View
      testID="combo-celebration"
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: -height * 0.38,
        width: boardSize,
        height,
      }}
    >
      {[0.42, 0.3, 0.18].map((widthRatio, index) => {
        const streakHeight = Math.max(2, boardSize * (0.026 - index * 0.008));
        const streakWidth = boardSize * widthRatio;
        return (
          <View
            key={`combo-streak-${index}`}
            testID={`combo-streak-${index}`}
            style={{
              position: 'absolute',
              left: centerX - streakWidth / 2,
              top: centerY - streakHeight / 2,
              width: streakWidth,
              height: streakHeight,
              borderRadius: streakHeight / 2,
              backgroundColor:
                index === 0
                  ? 'rgba(24,128,255,0.22)'
                  : index === 1
                    ? 'rgba(83,220,255,0.34)'
                    : 'rgba(255,231,91,0.72)',
              boxShadow:
                index === 2
                  ? '0 0 16px rgba(255,218,57,0.9)'
                  : '0 0 18px rgba(64,183,255,0.7)',
            }}
          />
        );
      })}

      {presentation.rays.map((ray, index) => {
        const angle = (ray.angleDeg * Math.PI) / 180;
        const left = centerX + Math.cos(angle) * ray.distance - ray.length / 2;
        const top = centerY + Math.sin(angle) * ray.distance * 0.62 - ray.thickness / 2;
        return (
          <View
            key={ray.id}
            testID={`combo-ray-${index}`}
            style={{
              position: 'absolute',
              left,
              top,
              width: ray.length,
              height: ray.thickness,
              borderRadius: ray.thickness / 2,
              backgroundColor: index % 3 === 0 ? '#FFE86B' : '#88ECFF',
              opacity: ray.opacity,
              transform: [{ rotate: `${ray.angleDeg}deg` }],
              boxShadow:
                index % 3 === 0
                  ? '0 0 9px rgba(255,220,71,0.85)'
                  : '0 0 8px rgba(91,220,255,0.75)',
            }}
          />
        );
      })}

      {presentation.particles.map((particle, index) => {
        const angle = (particle.angleDeg * Math.PI) / 180;
        const x = centerX + Math.cos(angle) * particle.distance - particle.size / 2;
        const y =
          centerY + Math.sin(angle) * particle.distance * 0.62 - particle.size / 2;
        const dx = Math.cos(angle) * particle.travel;
        const dy = Math.sin(angle) * particle.travel * 0.62;
        const particleAnimation = new Keyframe({
          0: {
            opacity: 0,
            transform: [{ translateX: -dx * 0.18 }, { translateY: -dy * 0.18 }, { scale: 0.25 }],
          },
          28: {
            opacity: 1,
            transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1.14 }],
          },
          68: {
            opacity: 0.92,
            transform: [{ translateX: dx * 0.72 }, { translateY: dy * 0.72 }, { scale: 0.92 }],
          },
          100: {
            opacity: 0,
            transform: [{ translateX: dx }, { translateY: dy }, { scale: 0.45 }],
          },
        })
          .duration(370)
          .delay(SPECTACLE_MOTION.praiseStartMs - 40 + particle.delayMs);

        return (
          <Animated.View
            key={particle.id}
            testID={`combo-particle-${index}`}
            entering={particleAnimation}
            style={{
              opacity: 0,
              position: 'absolute',
              left: x,
              top: y,
              width: particle.size * 1.4,
              height: particle.size * 1.4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ParticleShape particle={particle} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function CelebrationSweep({
  boardSize,
  strength,
  reducedMotion,
}: {
  boardSize: number;
  strength: number;
  reducedMotion: boolean;
}) {
  if (reducedMotion || strength <= 0) return null;

  const animation = new Keyframe({
    0: {
      opacity: 0,
      transform: [{ translateX: -boardSize * 0.42 }, { rotate: '-18deg' }, { scaleX: 0.7 }],
    },
    28: {
      opacity: 0.28 * strength,
      transform: [{ translateX: -boardSize * 0.08 }, { rotate: '-18deg' }, { scaleX: 1 }],
    },
    64: {
      opacity: 0.5 * strength,
      transform: [{ translateX: boardSize * 0.16 }, { rotate: '-18deg' }, { scaleX: 1.08 }],
    },
    100: {
      opacity: 0,
      transform: [{ translateX: boardSize * 0.44 }, { rotate: '-18deg' }, { scaleX: 0.8 }],
    },
  })
    .duration(430)
    .delay(SPECTACLE_MOTION.praiseStartMs + 115);

  return (
    <Animated.View
      entering={animation}
      style={{
        opacity: 0,
        position: 'absolute',
        top: -18,
        width: Math.max(22, boardSize * 0.08),
        height: Math.max(78, boardSize * 0.25),
      }}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.96)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1, borderRadius: 999 }}
      />
    </Animated.View>
  );
}

export function PraiseBanner() {
  const ctx = useDragCtx();
  const lastEvent = useGameStore((state) => state.lastEvent);
  const tone = useSettings((state) => state.praiseTone);
  const lang = useLang();
  const reducedMotion = useReducedMotion();

  if (!lastEvent || lastEvent.clearedCells.length === 0) return null;
  const banner: Banner = {
    id: praiseEventId(lastEvent),
    text:
      lastEvent.praise === 'none'
        ? null
        : praiseText(lastEvent.praise, tone, lang),
    tier: lastEvent.praise,
    combo: lastEvent.combo >= 2 ? lastEvent.combo : null,
    scoreDelta: lastEvent.scoreDelta,
    centroid: centroid(lastEvent.clearedCells, ctx.geom),
    fontSize: praiseFontSize(lastEvent.praise, ctx.geom.boardSize),
    reducedMotion,
  };

  const boardSize = ctx.geom.boardSize;
  const letterWidth = Math.round(boardSize * 0.66);
  const praiseFont = Math.min(32, Math.max(22, banner.fontSize * 0.8));
  const comboFont = Math.min(34, Math.max(24, Math.round(boardSize * 0.095)));
  const comboNumberFont = Math.round(comboFont * 1.2);
  const comboLabelWidth = Math.round(boardSize * (lang === 'ru' ? 0.44 : 0.34));
  const comboNumberWidth = Math.max(comboNumberFont * 1.4, boardSize * 0.18);
  const tierStyle = TIER_STYLE[banner.tier === 'none' ? 'good' : banner.tier];
  const showCelebration =
    banner.combo !== null ||
    banner.tier === 'great' ||
    banner.tier === 'amazing' ||
    banner.tier === 'unbelievable';
  const celebration = comboCelebrationFor(
    banner.combo ?? (banner.tier === 'unbelievable' ? 10 : banner.tier === 'amazing' ? 6 : 2),
    boardSize,
    banner.reducedMotion || !showCelebration,
  );
  const bannerTop = Math.max(
    4,
    Math.min(boardSize - comboNumberFont * 1.6, banner.centroid.y - comboFont * 0.55),
  );


  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: boardSize,
        height: boardSize,
      }}
    >
        <FeedbackMotion
          key={`score-${banner.id}`}
          testID="clear-score"
          variant="score"
          reducedMotion={banner.reducedMotion}
          boardSize={boardSize}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: bannerTop < 24 ? bannerTop + comboNumberFont * 1.35 : bannerTop - 22,
            alignItems: 'center',
          }}
        >
          <AppText
            preset="button"
            style={{
              fontFamily: LETTER_FONT,
              fontSize: Math.max(16, Math.round(banner.fontSize * 0.6)),
              color: FILL_COLOR,
              textShadowColor: 'rgba(12,23,48,0.9)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 5,
            }}
          >
            +{banner.scoreDelta}
          </AppText>
        </FeedbackMotion>

      {banner.text || banner.combo !== null ? (
          <FeedbackMotion
            key={`praise-${banner.id}`}
            testID="clear-praise"
            variant="praise"
            reducedMotion={banner.reducedMotion}
            boardSize={boardSize}
            entranceScale={celebration.entranceScale}
            style={{
              position: 'absolute',
              left: 0,
              top: bannerTop,
              width: boardSize,
              alignItems: 'center',
            }}
          >
            <CelebrationBurst boardSize={boardSize} presentation={celebration} />
            <CelebrationSweep
              boardSize={boardSize}
              strength={celebration.sweepStrength}
              reducedMotion={banner.reducedMotion}
            />
            {banner.combo !== null ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [
                    { rotate: '-2deg' },
                    { scale: celebration.labelScale },
                  ],
                }}
              >
                <Lettering
                  text={t('game.combo', lang)}
                  fontSize={comboFont}
                  width={comboLabelWidth}
                  glow={COMBO_LABEL.glow}
                  variant="combo"
                  fill={COMBO_LABEL.fill}
                  outline={COMBO_LABEL.outline}
                  depthColor={COMBO_LABEL.depth}
                />
                <View style={{ marginLeft: -Math.round(comboFont * 0.19), marginTop: -comboFont * 0.06 }}>
                  <Lettering
                    text={String(banner.combo)}
                    fontSize={comboNumberFont}
                    width={comboNumberWidth}
                    glow={COMBO_NUMBER.glow}
                    variant="number"
                    fill={COMBO_NUMBER.fill}
                    outline={COMBO_NUMBER.outline}
                    depthColor={COMBO_NUMBER.depth}
                  />
                </View>
              </View>
            ) : banner.text ? (
              <View
                style={{
                  marginTop: -Math.round(praiseFont * 0.18),
                  transform: [{ rotate: '-2deg' }, { scale: celebration.labelScale }],
                }}
              >
                <Lettering
                  text={banner.text}
                  fontSize={praiseFont}
                  width={letterWidth}
                  glow={tierStyle.glow}
                  variant="praise"
                  fill={tierStyle.fill}
                  outline={tierStyle.outline}
                  depthColor={tierStyle.depth}
                />
              </View>
            ) : null}
          </FeedbackMotion>
      ) : null}
    </View>
  );
}
