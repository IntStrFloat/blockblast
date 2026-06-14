import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { AppText, colors, CrownIcon } from '@/ui';

import { scoreScaleFor } from '../animation/gameFeelPresentation';
import { GAME_FEEL_MOTION } from '../animation/motion';
import { useReducedMotion } from '../animation/useReducedMotion';
import { ComboBadge } from '../effects/ComboBadge';
import { useGameStore } from '../store';

const SCORE_SHELL_HEIGHT = 64;
const SCORE_SHELL_BASE_WIDTH = 128;
const SHIMMER_THRESHOLD = 120;

function cappedScoreScale(scale: number) {
  return Math.min(scale, GAME_FEEL_MOTION.scoreScaleMax);
}

function scorePulseAnimation(reducedMotion: boolean, scoreScale: number, shimmer: boolean) {
  return new Keyframe(
    reducedMotion
      ? {
          0: { opacity: 0, transform: [{ scale: cappedScoreScale(scoreScale * 0.96) }] },
          34: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * 1.01) }] },
          100: { opacity: 1, transform: [{ scale: scoreScale }] },
        }
      : shimmer
        ? {
            0: { opacity: 0.92, transform: [{ scale: cappedScoreScale(scoreScale * 0.84) }] },
            20: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * 1.08) }] },
            48: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * 1.02) }] },
            74: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * 1.06) }] },
            100: { opacity: 1, transform: [{ scale: scoreScale }] },
          }
        : {
            0: { opacity: 0.96, transform: [{ scale: cappedScoreScale(scoreScale * 0.88) }] },
            28: { opacity: 1, transform: [{ scale: cappedScoreScale(scoreScale * 1.09) }] },
            100: { opacity: 1, transform: [{ scale: scoreScale }] },
          },
  ).duration(reducedMotion ? 180 : shimmer ? 360 : 260);
}

function ScoreCounter() {
  const score = useGameStore((s) => s.game.score);
  const recordCelebrated = useGameStore((s) => s.recordCelebrated);
  const reducedMotion = useReducedMotion();
  const previousScoreRef = useRef(score);
  const [pulseKey, setPulseKey] = useState(0);
  const [lastJump, setLastJump] = useState(0);

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

  const scoreScale = scoreScaleFor(score);
  const shimmer = lastJump >= SHIMMER_THRESHOLD;
  const scoreColor = recordCelebrated ? colors.accent : colors.textPrimary;

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
        entering={scorePulseAnimation(reducedMotion, scoreScale, shimmer)}
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
            textShadowColor: recordCelebrated ? 'rgba(255, 214, 64, 0.45)' : 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: recordCelebrated ? 12 : 0,
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
}

export function Hud({ onPause }: HudProps) {
  const best = useScores((s) => s.best);
  const lang = useLang();

  return (
    <View style={{ width: '100%', paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ minWidth: 72 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <CrownIcon size={13} />
            <AppText preset="caption">{t('game.best', lang)}</AppText>
          </View>
          <AppText preset="button" style={{ color: colors.accent }}>
            {best}
          </AppText>
        </View>

        <View style={{ alignItems: 'center' }}>
          <ScoreCounter />
          <ComboBadge />
        </View>

        <Pressable
          onPress={onPause}
          hitSlop={8}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText preset="button">II</AppText>
        </Pressable>
      </View>
    </View>
  );
}
