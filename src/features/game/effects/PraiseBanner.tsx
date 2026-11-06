import { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { PlacementEvent } from '@/core/engine';
import { praiseText, t } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { AppText, nightCandy as n } from '@/ui';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useDragCtx } from '../drag/DragContext';
import { useGameStore } from '../store';

function ClearFeedback({ event }: { event: PlacementEvent }) {
  const { geom } = useDragCtx();
  const lang = useLang();
  const tone = useSettings((s) => s.praiseTone);
  const showMascot = useSettings((s) => s.showMascot);
  const adventure = useGameStore((s) => Boolean(s.adventure));
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useLayoutEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: reduced ? 200 : n.motion.combo,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    });
    return () => cancelAnimation(progress);
  }, [event, progress, reduced]);
  const comboStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(
        p,
        [0, 0.08, 0.22, 0.75, 0.9, 1],
        [0, 0, 1, 1, 0, 0],
      ),
      transform: [
        { translateY: reduced ? 0 : interpolate(p, [0, 0.75, 1], [0, 0, -10]) },
        {
          scale: reduced
            ? 1
            : interpolate(
                p,
                [0, 0.08, 0.22, 0.32, 0.75, 1],
                [0.3, 0.3, 1.18, 1, 1, 1.1],
              ),
        },
        {
          rotate: `${reduced ? 0 : interpolate(p, [0, 0.08, 0.22, 0.32, 0.75, 1], [-8, -8, 3, -2, 0, 0])}deg`,
        },
      ],
    };
  });
  const scoreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.2, 0.32, 0.8, 1],
      [0, 0, 1, 1, 0],
    ),
    transform: [
      {
        translateY: reduced
          ? 0
          : interpolate(progress.value, [0, 0.2, 0.8, 1], [10, 10, -34, -44]),
      },
    ],
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.15, 0.3, 0.8, 1],
      [0, 0, 1, 1, 0],
    ),
  }));
  const copy =
    event.praise === 'none' ? null : praiseText(event.praise, tone, lang);
  return (
    <View
      testID="board-praise-bounds"
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        width: geom.boardSize,
        height: geom.boardSize,
        overflow: 'visible',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: geom.cell * 1.5,
          alignItems: 'center',
          gap: 2,
        }}
      >
        {event.combo >= 2 ? (
          <Animated.View testID="clear-praise" style={comboStyle}>
            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              allowFontScaling={false}
              style={{
                fontFamily: 'Unbounded_900Black',
                fontSize: Math.min(48, geom.boardSize * 0.135),
                lineHeight: Math.min(60, geom.boardSize * 0.17),
                color: n.sun,
                textShadowColor: n.sunEdge,
                textShadowOffset: { width: 0, height: 5 },
                textShadowRadius: 0,
              }}
            >
              {t('game.combo', lang)} ×{event.combo}
            </AppText>
          </Animated.View>
        ) : null}
        <Animated.View testID="clear-score" style={scoreStyle}>
          <AppText
            style={{
              fontFamily: 'Unbounded_800ExtraBold',
              fontSize: 28,
              lineHeight: 36,
              color: n.white,
              textShadowColor: 'rgba(5,8,40,.55)',
              textShadowOffset: { width: 0, height: 3 },
              textShadowRadius: 0,
            }}
          >
            +{event.scoreDelta}
          </AppText>
        </Animated.View>
      </View>
      {copy && showMascot && !adventure ? (
        <Animated.View
          testID="clear-capy-praise"
          style={[
            {
              position: 'absolute',
              right: -2,
              top: -62,
              maxWidth: '80%',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: n.white,
              boxShadow: '0 8px 18px rgba(3,5,30,.35)',
            },
            bubbleStyle,
          ]}
        >
          <AppText
            style={{
              fontFamily: 'Nunito_800ExtraBold',
              fontSize: 14,
              lineHeight: 19,
              color: '#1B1F5E',
            }}
          >
            {copy}
          </AppText>
          <View
            style={{
              position: 'absolute',
              right: 22,
              bottom: -5,
              width: 12,
              height: 12,
              backgroundColor: n.white,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function PraiseBanner({ suppressed = false }: { suppressed?: boolean }) {
  const event = useGameStore((s) => s.lastEvent);
  const [skipped, setSkipped] = useState<PlacementEvent | null>(null);
  if (suppressed && event && skipped !== event) setSkipped(event);
  if (
    !event ||
    event.clearedCells.length === 0 ||
    suppressed ||
    skipped === event
  )
    return null;
  return <ClearFeedback event={event} />;
}
