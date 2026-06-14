import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, colors, radii } from '@/ui';

import { GAME_FEEL_MOTION } from '../animation/motion';
import { useReducedMotion } from '../animation/useReducedMotion';
import { type RecordCelebration, useGameStore } from '../store';
import { Confetti } from './Confetti';

const RECORD_GOLD = ['#F5C451', '#FFE27A', '#FFF6BA', '#FFFDF2'] as const;
const CELEBRATION_HIDE_MS = 1200;
const REDUCED_HIDE_MS = 360;
const BANNER_MAX_WIDTH = '88%';

interface ActiveCelebration {
  id: number;
  record: RecordCelebration;
}

function titleAnimation(reducedMotion: boolean) {
  return new Keyframe(
    reducedMotion
      ? {
          0: { opacity: 0, transform: [{ scale: 0.94 }] },
          30: { opacity: 1, transform: [{ scale: 1 }] },
          100: { opacity: 0, transform: [{ scale: 0.98 }] },
        }
      : {
          0: { opacity: 0, transform: [{ scale: 0.82 }, { translateY: -4 }] },
          28: { opacity: 1, transform: [{ scale: 1.06 }, { translateY: 0 }] },
          68: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
          100: { opacity: 0, transform: [{ scale: 1.02 }, { translateY: -10 }] },
        },
  ).duration(reducedMotion ? REDUCED_HIDE_MS : CELEBRATION_HIDE_MS);
}

function scoreAnimation(reducedMotion: boolean) {
  return new Keyframe(
    reducedMotion
      ? {
          0: { opacity: 0, transform: [{ scale: 0.9 }] },
          34: { opacity: 1, transform: [{ scale: 1.03 }] },
          100: { opacity: 0, transform: [{ scale: 0.98 }] },
        }
      : {
          0: { opacity: 0, transform: [{ scale: 0.78 }, { translateY: 0 }] },
          24: { opacity: 1, transform: [{ scale: 1.18 }, { translateY: -2 }] },
          54: { opacity: 1, transform: [{ scale: 1.05 }, { translateY: -4 }] },
          100: { opacity: 0, transform: [{ scale: 1.01 }, { translateY: -10 }] },
        },
  ).duration(reducedMotion ? REDUCED_HIDE_MS : CELEBRATION_HIDE_MS);
}

export function NewRecordCelebration() {
  const lang = useLang();
  const reducedMotion = useReducedMotion();
  const recordCelebration = useGameStore((state) => state.recordCelebration);
  const [active, setActive] = useState<ActiveCelebration | null>(null);
  const counter = useRef(0);
  const handledRef = useRef<RecordCelebration | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!recordCelebration || handledRef.current === recordCelebration) {
      return;
    }

    handledRef.current = recordCelebration;

    const id = ++counter.current;
    setActive({ id, record: recordCelebration });

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (counter.current === id) {
        setActive(null);
      }
    }, reducedMotion ? REDUCED_HIDE_MS : CELEBRATION_HIDE_MS);
  }, [recordCelebration, reducedMotion]);

  if (!active) return null;

  return (
    <View
      testID="new-record-celebration"
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 18,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 70,
      }}
    >
      <Confetti
        height={220}
        count={GAME_FEEL_MOTION.recordConfettiMax}
        palette={[...RECORD_GOLD]}
        reducedMotion={reducedMotion}
        seed={active.record.score * 31 + active.record.previousBest * 17}
        testIdPrefix="record-confetti-piece-"
      />

      <Animated.View
        key={`record-title-${active.id}`}
        entering={titleAnimation(reducedMotion)}
        style={{
          width: '100%',
          maxWidth: BANNER_MAX_WIDTH,
          paddingHorizontal: 16,
          alignItems: 'center',
          opacity: 0,
          transform: [{ scale: 1 }],
        }}
      >
        <AppText
          testID="new-record-title"
          preset="button"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={{
            color: colors.accent,
            width: '100%',
            textAlign: 'center',
            textShadowColor: 'rgba(255, 236, 155, 0.45)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 10,
          }}
        >
          {t('gameOver.newRecord', lang)}
        </AppText>
      </Animated.View>

      <Animated.View
        testID="new-record-score-shell"
        key={`record-score-${active.id}`}
        entering={scoreAnimation(reducedMotion)}
        style={{
          marginTop: 6,
          width: '100%',
          maxWidth: BANNER_MAX_WIDTH,
          borderRadius: radii.button,
          paddingHorizontal: 16,
          paddingVertical: 6,
          backgroundColor: 'rgba(20, 26, 46, 0.72)',
          opacity: 0,
          transform: [{ scale: 1 }],
        }}
      >
        <AppText
          testID="new-record-score"
          preset="score"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.58}
          style={{
            color: colors.accent,
            width: '100%',
            textAlign: 'center',
            textShadowColor: 'rgba(255, 214, 64, 0.5)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 14,
          }}
        >
          {active.record.score}
        </AppText>
      </Animated.View>
    </View>
  );
}
