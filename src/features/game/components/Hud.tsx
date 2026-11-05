import { useEffect, useRef } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { AppText, colors, CrownIcon, GearIcon } from '@/ui';

import { scoreScaleFor } from '../animation/gameFeelPresentation';
import { GAME_FEEL_MOTION } from '../animation/motion';
import { recordProgressFor, type RecordProgressStage } from '../animation/recordProgression';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useGameStore } from '../store';
import { formatHudBestScore, getClassicHudMetrics, hudNumberFontSize } from '../playfield-layout';
import { ComboScoreBloom } from './ComboScoreBloom';
import { RecordStatusBadge } from './RecordStatusBadge';

const SHIMMER_THRESHOLD = 120;

function scorePulseBoost(recordStage: RecordProgressStage) {
  return recordStage === 'record_broken'
      ? 0.15
      : recordStage === 'near'
        ? 0.06
        : recordStage === 'pursuit'
          ? 0.05
          : 0.04;
}

function ScoreCounter({ layout }: { layout: ReturnType<typeof getClassicHudMetrics> }) {
  const score = useGameStore((s) => s.game.score);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const reducedMotion = useReducedMotion();
  const previousScoreRef = useRef(score);
  const restingScale = useSharedValue(scoreScaleFor(score));
  const pulseProgress = useSharedValue(1);
  const pulseBoost = useSharedValue(0.04);

  useEffect(() => {
    const previousScore = previousScoreRef.current;
    previousScoreRef.current = score;
    cancelAnimation(pulseProgress);
    restingScale.set(scoreScaleFor(score));
    pulseProgress.set(1);
    if (score > previousScore && !reducedMotion) {
      pulseBoost.set(scorePulseBoost(recordProgressFor(score, runBestAtStart, previousScore).stage));
      pulseProgress.set(0);
      pulseProgress.set(withTiming(1, {
        duration: score - previousScore >= SHIMMER_THRESHOLD ? 320 : 220,
        easing: Easing.linear,
      }));
    }
    return () => cancelAnimation(pulseProgress);
  }, [pulseBoost, pulseProgress, reducedMotion, restingScale, runBestAtStart, score]);

  const pulseStyle = useAnimatedStyle(() => {
    const boost = pulseBoost.get();
    const multiplier = interpolate(pulseProgress.get(), [0, 0.2, 0.52, 0.76, 1], [0.96, 1 + boost, 1.01, 1 + boost * 0.55, 1]);
    return { transform: [{ scale: Math.min(GAME_FEEL_MOTION.scoreScaleMax, restingScale.get() * multiplier) }] };
  });
  const fontSize = hudNumberFontSize(score, layout.scoreWidth, layout.fontSize);
  const previousScore = lastEvent?.score === score ? score - lastEvent.scoreDelta : score;
  const recordProgress = recordProgressFor(score, runBestAtStart, previousScore);
  const isLiveRecord = runBestAtStart > 0 && score > runBestAtStart;
  const scoreColor = isLiveRecord
    ? colors.accent
    : recordProgress.stage === 'near'
      ? '#FFF4C2'
      : colors.textPrimary;

  return (
    <View
      testID="hud-score-shell"
      style={{
        height: layout.scoreShellHeight,
        width: layout.centerWidth,
        minWidth: layout.centerWidth,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible',
      }}
    >
      <ComboScoreBloom />
      <Animated.View
        testID="hud-score-pulse-0"
        style={[{ width: layout.scoreWidth, height: layout.scoreHeight, justifyContent: 'center', opacity: 1 }, pulseStyle]}
      >
        <AppText
          testID="hud-score-text"
          preset="score"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.35}
          allowFontScaling={false}
          style={{
            width: '100%',
            fontSize,
            lineHeight: Math.ceil(fontSize * 1.2),
            includeFontPadding: false,
            textAlign: 'center',
            textAlignVertical: 'center',
            color: scoreColor,
            textShadowColor: isLiveRecord ? 'rgba(255, 214, 64, 0.45)' : 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: isLiveRecord ? 12 : 0,
          }}
        >
          {score}
        </AppText>
      </Animated.View>
    </View>
  );
}

interface HudProps {
  onPause: () => void;
  compact?: boolean;
}

export function Hud({ onPause, compact = false }: HudProps) {
  const { width } = useWindowDimensions();
  const layout = getClassicHudMetrics(width, compact);
  const best = useScores((s) => s.best);
  const score = useGameStore((s) => s.game.score);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const lang = useLang();
  const liveBest = runBestAtStart > 0 ? Math.max(best, score) : best;
  const visibleBest = formatHudBestScore(liveBest, lang);
  const bestFontSize = Math.max(12, hudNumberFontSize(visibleBest, layout.sideWidth, 14));

  return (
    <View
      testID="game-hud"
      style={{
        width: '100%',
        height: layout.height,
        paddingHorizontal: layout.padding,
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.gap }}>
        <View
          testID="hud-best"
          style={{
            alignItems: 'center',
            gap: 2,
            width: layout.sideWidth,
            minWidth: 0,
          }}
        >
          <CrownIcon size={22} />
          <AppText
            testID="hud-best-value"
            preset="button"
            accessibilityLabel={`${t('home.best', lang)} ${liveBest}`}
            numberOfLines={1}
            allowFontScaling={false}
            style={{
              color: colors.accent,
              fontSize: bestFontSize,
              width: '100%',
              lineHeight: Math.ceil(bestFontSize * 1.25),
              textAlign: 'center',
              includeFontPadding: false,
              fontVariant: ['tabular-nums'],
              flexShrink: 1,
            }}
          >
            {visibleBest}
          </AppText>
        </View>

        <View
          testID="hud-score-column"
          style={{
            height: layout.height,
            width: layout.centerWidth,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ScoreCounter layout={layout} />
          <View
            testID="hud-combo-slot"
            style={{
              height: layout.statusHeight,
              width: layout.statusWidth,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RecordStatusBadge compact={compact} />
          </View>
        </View>

        <Pressable
          testID="hud-settings"
          accessibilityRole="button"
          accessibilityLabel={t('settings.title', lang)}
          onPress={onPause}
          hitSlop={8}
          style={({ pressed }) => [{
            width: layout.sideWidth,
            minWidth: 0,
            height: 48,
            alignItems: 'flex-end',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          }]}
        >
          <GearIcon size={25} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}
