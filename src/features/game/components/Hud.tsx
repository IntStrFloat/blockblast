import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
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
import { RecordStatusBadge } from './RecordStatusBadge';

const SCORE_SHELL_HEIGHT = 64;
const SCORE_SHELL_BASE_WIDTH = 128;
const COMBO_BADGE_RESERVED_HEIGHT = 28;
const HUD_RESERVED_HEIGHT =
  Math.ceil(SCORE_SHELL_HEIGHT * GAME_FEEL_MOTION.scoreScaleMax) + COMBO_BADGE_RESERVED_HEIGHT;
const SHIMMER_THRESHOLD = 120;
const LIVE_SCORE_COUNT_UP_DURATION = 420;

function cappedScoreScale(scale: number) {
  return Math.min(scale, GAME_FEEL_MOTION.scoreScaleMax);
}

function scorePulseAnimation(
  reducedMotion: boolean,
  scoreScale: number,
  shimmer: boolean,
  recordStage: RecordProgressStage,
) {
  const boost =
    recordStage === 'record_broken'
      ? 0.15
      : recordStage === 'near'
        ? 0.06
        : recordStage === 'pursuit'
          ? 0.05
          : 0.04;
  return new Keyframe(
    reducedMotion
      ? {
          0: { opacity: 0, transform: [{ scale: cappedScoreScale(scoreScale * 0.96) }] },
          34: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * 1.01) }] },
          100: { opacity: 1, transform: [{ scale: scoreScale }] },
        }
      : shimmer
        ? {
            0: { opacity: 0.92, transform: [{ scale: cappedScoreScale(scoreScale * 0.94) }] },
            20: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * (1 + boost)) }] },
            52: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * 1.01) }] },
            76: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * (1 + boost * 0.55)) }] },
            100: { opacity: 1, transform: [{ scale: scoreScale }] },
          }
        : {
            0: { opacity: 0.96, transform: [{ scale: cappedScoreScale(scoreScale * 0.96) }] },
            34: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * (1 + boost)) }] },
            100: { opacity: 1, transform: [{ scale: scoreScale }] },
          },
  ).duration(reducedMotion ? 160 : shimmer ? 320 : 220);
}

function ScoreCounter() {
  const score = useGameStore((s) => s.game.score);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const reducedMotion = useReducedMotion();
  const previousScoreRef = useRef(score);
  const displayedScoreRef = useRef(score);
  const [pulseKey, setPulseKey] = useState(0);
  const [lastJump, setLastJump] = useState(0);
  const [displayedScore, setDisplayedScore] = useState(score);
  const countProgress = useSharedValue(1);
  const countFrom = useSharedValue(score);
  const countTo = useSharedValue(score);

  const commitDisplayedScore = useCallback((nextScore: number) => {
    displayedScoreRef.current = nextScore;
    setDisplayedScore(nextScore);
  }, []);

  useEffect(() => {
    const nextScore = score;
    if (nextScore <= previousScoreRef.current) {
      previousScoreRef.current = nextScore;
      return;
    }

    setLastJump(nextScore - previousScoreRef.current);
    setPulseKey((value) => value + 1);
    previousScoreRef.current = nextScore;
  }, [score]);

  useEffect(() => {
    const currentDisplayedScore = displayedScoreRef.current;
    cancelAnimation(countProgress);

    if (score <= currentDisplayedScore) {
      countFrom.value = score;
      countTo.value = score;
      countProgress.value = 1;
      if (score !== currentDisplayedScore) commitDisplayedScore(score);
      return;
    }

    countFrom.value = currentDisplayedScore;
    countTo.value = score;
    countProgress.value = 0;
    countProgress.value = reducedMotion
      ? 1
      : withTiming(1, {
          duration: LIVE_SCORE_COUNT_UP_DURATION,
          easing: Easing.out(Easing.cubic),
        });

    return () => cancelAnimation(countProgress);
  }, [commitDisplayedScore, countFrom, countProgress, countTo, reducedMotion, score]);

  useAnimatedReaction(
    () => Math.round(countFrom.value + (countTo.value - countFrom.value) * countProgress.value),
    (nextScore, previousScore) => {
      if (nextScore !== previousScore) runOnJS(commitDisplayedScore)(nextScore);
    },
    [commitDisplayedScore],
  );

  const scoreScale = scoreScaleFor(score);
  const shimmer = lastJump >= SHIMMER_THRESHOLD;
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
        minHeight: Math.ceil(SCORE_SHELL_HEIGHT * GAME_FEEL_MOTION.scoreScaleMax),
        minWidth: Math.ceil(SCORE_SHELL_BASE_WIDTH * GAME_FEEL_MOTION.scoreScaleMax),
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible',
      }}
    >
      <Animated.View
        key={pulseKey}
        testID={`hud-score-pulse-${pulseKey}`}
        entering={scorePulseAnimation(reducedMotion, scoreScale, shimmer, recordProgress.stage)}
        style={{
          opacity: 1,
          transform: [{ scale: scoreScale }],
        }}
      >
        <AppText
          testID="hud-score-text"
          preset="score"
          style={{
            color: scoreColor,
            textShadowColor: isLiveRecord ? 'rgba(255, 214, 64, 0.45)' : 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: isLiveRecord ? 12 : 0,
          }}
        >
          {displayedScore}
        </AppText>
      </Animated.View>
    </View>
  );
}

interface HudProps {
  onPause: () => void;
}

export function Hud({ onPause }: HudProps) {
  const best = useScores((s) => s.best);
  const score = useGameStore((s) => s.game.score);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const lang = useLang();
  const liveBest = runBestAtStart > 0 ? Math.max(best, score) : best;

  return (
    <View
      style={{
        width: '100%',
        height: HUD_RESERVED_HEIGHT,
        paddingHorizontal: 16,
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          testID="hud-best"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            flex: 1,
            minWidth: 0,
          }}
        >
          <CrownIcon size={22} />
          <AppText
            testID="hud-best-value"
            preset="button"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.62}
            style={{
              color: colors.accent,
              fontSize: 22,
              fontVariant: ['tabular-nums'],
              flexShrink: 1,
            }}
          >
            {liveBest}
          </AppText>
        </View>

        <View
          testID="hud-score-column"
          style={{
            height: HUD_RESERVED_HEIGHT,
            width: 152,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ScoreCounter />
          <View
            testID="hud-combo-slot"
            style={{
              height: COMBO_BADGE_RESERVED_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RecordStatusBadge />
          </View>
        </View>

        <Pressable
          testID="hud-settings"
          accessibilityRole="button"
          accessibilityLabel={t('settings.title', lang)}
          onPress={onPause}
          hitSlop={8}
          style={({ pressed }) => [{
            flex: 1,
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
