import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import type { PraiseTier } from '@/core/engine';
import { fireText, praiseText, t } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { AppText } from '@/ui';

import { praiseFontSize } from '../animation/clearPresentation';
import { SPECTACLE_MOTION } from '../animation/motion';
import { centroid } from '../animation/presentationMath';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useDragCtx } from '../drag/DragContext';
import { useGameStore } from '../store';

const PRAISE_ENTER_MS = 390;
const PRAISE_REDUCED_ENTER_MS = 240;
const SCORE_ENTER_MS = 360;
const SCORE_REDUCED_ENTER_MS = 210;
const HIDDEN_AFTER_ENTER_OPACITY = 0;

// Округлый «сочный» шрифт как в оригинале Block Blast (не угловатый Unbounded).
const LETTER_FONT = 'Fredoka_700Bold';
// Тёмный контур/экструзия — тон линий доски, читается на любом фоне блоков.
const OUTLINE_COLOR = '#0C1730';
// Кремовая заливка держит максимальный контраст на тёмной доске; тир кодируем
// цветом свечения/контура, а не заливкой (иначе холодные тиры теряют контраст).
const FILL_COLOR = '#FFF6E4';

/** Цвет свечения по тиру похвалы — «горячее» с ростом достижения. */
const TIER_GLOW: Record<Exclude<PraiseTier, 'none'>, string> = {
  good: 'rgba(93,216,255,0.9)',
  great: 'rgba(61,220,132,0.9)',
  amazing: 'rgba(179,131,255,0.95)',
  unbelievable: 'rgba(255,176,32,1)',
};

const COMBO_GLOW = 'rgba(255,159,28,0.95)';

interface Banner {
  id: number;
  text: string | null;
  tier: PraiseTier;
  comboText: string | null;
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
}

/**
 * Леттеринг в два слоя (никаких клип-масок с независимым автоскейлом, которые
 * могли «двоить»): тёмная копия-контур со смещением вниз даёт объём, светлая
 * копия сверху несёт цветное свечение тира. Оба слоя — один и тот же Text с
 * одинаковыми ограничениями, поэтому автоподбор кегля сходится к одному размеру.
 */
function Lettering({ text, fontSize, width, glow }: LetteringProps) {
  const lineHeight = Math.round(fontSize * 1.22);
  const depth = Math.max(2, Math.round(fontSize * 0.08));
  const fitProps = {
    numberOfLines: 1,
    adjustsFontSizeToFit: true,
    minimumFontScale: 0.55,
  } as const;
  const baseStyle = {
    textAlign: 'center' as const,
    fontFamily: LETTER_FONT,
    fontSize,
    lineHeight,
    letterSpacing: 0.3,
    paddingHorizontal: 14,
  };

  return (
    <View style={{ width, height: lineHeight + depth }}>
      <AppText
        preset="title"
        {...fitProps}
        style={[
          baseStyle,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: depth,
            color: OUTLINE_COLOR,
            textShadowColor: OUTLINE_COLOR,
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          },
        ]}
      >
        {text}
      </AppText>
      <AppText
        preset="title"
        {...fitProps}
        style={[
          baseStyle,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            color: FILL_COLOR,
            textShadowColor: glow,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 14,
          },
        ]}
      >
        {text}
      </AppText>
    </View>
  );
}

function formatComboText(text: string) {
  return text.replace(/\s*🔥/g, '').replace(/\bx(\d+)/gi, '×$1');
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
    const id = ++counter.current;
    const rawComboText =
      lastEvent.combo >= 2
        ? lastEvent.onFire
          ? fireText(tone, lang, lastEvent.combo)
          : `${t('game.combo', lang)} ×${lastEvent.combo}`
        : null;
    const comboText = rawComboText ? formatComboText(rawComboText) : null;
    setBanner({
      id,
      text:
        lastEvent.praise === 'none'
          ? null
          : praiseText(lastEvent.praise, tone, lang),
      tier: lastEvent.praise,
      comboText,
      scoreDelta: lastEvent.scoreDelta,
      // Лёгкие расчёты вместо buildClearPresentation: полную презентацию
      // (осколки/крошку/бюджеты) уже строит BoardView, дублировать её в
      // самый нагруженный кадр клира нельзя.
      centroid: centroid(lastEvent.clearedCells, ctx.geom),
      fontSize: praiseFontSize(lastEvent.praise, ctx.geom.boardSize),
      reducedMotion,
    });
    const timer = setTimeout(() => {
      if (counter.current === id) setBanner(null);
    }, SPECTACLE_MOTION.praiseEndMs + 80);
    return () => clearTimeout(timer);
  }, [ctx.geom, lang, lastEvent, reducedMotion, tone]);

  if (!banner) return null;

  const praiseAnimation = new Keyframe(
    banner.reducedMotion
      ? {
          0: { opacity: 0, transform: [{ scale: 0.98 }] },
          28: { opacity: 1, transform: [{ scale: 1 }] },
          74: { opacity: 1, transform: [{ scale: 1 }] },
          100: { opacity: 0, transform: [{ scale: 0.98 }] },
        }
      : {
          // Слэм как в оригинале: буквы влетают с перелётом и коротко дрожат.
          0: {
            opacity: 0,
            transform: [{ scale: 0.4 }, { translateY: 10 }],
          },
          30: {
            opacity: 1,
            transform: [{ scale: 1.12 }, { translateY: -2 }],
          },
          46: {
            opacity: 1,
            transform: [{ scale: 0.97 }, { translateY: 0 }],
          },
          58: {
            opacity: 1,
            transform: [{ scale: 1.02 }, { translateY: 0 }],
          },
          82: {
            opacity: 1,
            transform: [{ scale: 1 }, { translateY: 0 }],
          },
          100: {
            opacity: 0,
            transform: [{ scale: 0.96 }, { translateY: -14 }],
          },
        },
  )
    .duration(banner.reducedMotion ? PRAISE_REDUCED_ENTER_MS : PRAISE_ENTER_MS)
    .delay(banner.reducedMotion ? 70 : SPECTACLE_MOTION.praiseStartMs);

  // Мягкий одиночный пульс-«вспышка» вместо колючего лучевого веера
  // (правило excessive-motion: 1–2 акцента, не декор ради декора).
  const pulseAnimation = new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.35 }] },
    38: { opacity: 0.4, transform: [{ scale: 1 }] },
    100: { opacity: 0, transform: [{ scale: 1.45 }] },
  })
    .duration(PRAISE_ENTER_MS + 90)
    .delay(SPECTACLE_MOTION.praiseStartMs);

  const scoreAnimation = new Keyframe(
    banner.reducedMotion
      ? {
          0: { opacity: 0, transform: [{ scale: 0.9 }] },
          35: { opacity: 1, transform: [{ scale: 1 }] },
          100: { opacity: 0, transform: [{ scale: 1 }] },
        }
      : {
          0: { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.55 }] },
          26: { opacity: 1, transform: [{ translateY: -8 }, { scale: 1.08 }] },
          50: { opacity: 1, transform: [{ translateY: -17 }, { scale: 1 }] },
          100: {
            opacity: 0,
            transform: [{ translateY: -ctx.geom.boardSize * 0.2 }, { scale: 0.9 }],
          },
        },
  )
    .duration(banner.reducedMotion ? SCORE_REDUCED_ENTER_MS : SCORE_ENTER_MS)
    .delay(banner.reducedMotion ? 40 : 175);

  const boardSize = ctx.geom.boardSize;
  const letterWidth = Math.round(boardSize * 0.94);
  const praiseFont = Math.min(banner.fontSize, 40);
  const comboFont = banner.text
    ? Math.max(17, Math.round(praiseFont * 0.58))
    : Math.min(34, Math.round(boardSize * 0.1));
  const praiseGlow = TIER_GLOW[banner.tier === 'none' ? 'good' : banner.tier];
  const pulseSize = Math.round(boardSize * 0.64);
  const showPulse = !banner.reducedMotion && (banner.text !== null || banner.comboText !== null);

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
      <Animated.View
        key={`score-${banner.id}`}
        entering={scoreAnimation}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: banner.centroid.y - 16,
          alignItems: 'center',
          opacity: HIDDEN_AFTER_ENTER_OPACITY,
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
      </Animated.View>

      {banner.text || banner.comboText ? (
        <Animated.View
          key={`praise-${banner.id}`}
          entering={praiseAnimation}
          style={{
            position: 'absolute',
            left: 0,
            top: boardSize * 0.26,
            width: boardSize,
            alignItems: 'center',
            opacity: HIDDEN_AFTER_ENTER_OPACITY,
          }}
        >
          {showPulse ? (
            <Animated.View
              key={`pulse-${banner.id}`}
              entering={pulseAnimation}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -pulseSize * 0.28,
                width: pulseSize,
                height: pulseSize,
                borderRadius: pulseSize / 2,
                backgroundColor: banner.comboText ? COMBO_GLOW : praiseGlow,
                opacity: 0,
              }}
            />
          ) : null}
          {banner.text ? (
            <Lettering text={banner.text} fontSize={praiseFont} width={letterWidth} glow={praiseGlow} />
          ) : null}
          {banner.comboText ? (
            <View style={{ marginTop: banner.text ? 2 : 0 }}>
              <Lettering
                text={banner.comboText}
                fontSize={comboFont}
                width={letterWidth}
                glow={COMBO_GLOW}
              />
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
