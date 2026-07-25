import { useEffect, useRef, useState } from 'react';
import Animated, { Keyframe } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText } from '@/ui';

import {
  RECORD_PROGRESS,
  recordProgressFor,
  type RecordProgressStage,
} from '../animation/recordProgression';
import { useReducedMotion } from '../animation/useReducedMotion';
import { ComboBadge } from '../effects/ComboBadge';
import { useGameStore } from '../store';

function badgeAnimation(reducedMotion: boolean) {
  return new Keyframe(
    reducedMotion
      ? {
          0: { opacity: 0 },
          100: { opacity: 1 },
        }
      : {
          0: { opacity: 0, transform: [{ scale: 0.92 }, { translateY: 3 }] },
          58: { opacity: 1, transform: [{ scale: 1.04 }, { translateY: 0 }] },
          100: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
        },
  ).duration(reducedMotion ? 100 : RECORD_PROGRESS.goalChipEnterMs);
}

export function RecordStatusBadge() {
  const score = useGameStore((s) => s.game.score);
  const combo = useGameStore((s) => s.game.combo);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const recordCelebration = useGameStore((s) => s.recordCelebration);
  const lang = useLang();
  const reducedMotion = useReducedMotion();
  const handledRef = useRef<typeof recordCelebration>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRecordTitle, setShowRecordTitle] = useState(false);

  useEffect(() => {
    if (!recordCelebration || handledRef.current === recordCelebration) return;
    handledRef.current = recordCelebration;
    setShowRecordTitle(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setShowRecordTitle(false);
    }, reducedMotion ? 420 : RECORD_PROGRESS.celebrationMs);
    return () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [recordCelebration, reducedMotion]);

  if (combo >= 2 && !showRecordTitle) return <ComboBadge />;

  const progress = recordProgressFor(score, runBestAtStart);
  let label: string | null = null;
  let value: string | null = null;
  let stage: RecordProgressStage = progress.stage;

  if (showRecordTitle) {
    label = t('gameOver.newRecord', lang);
    stage = 'record_broken';
  } else if (progress.stage === 'pursuit' || progress.stage === 'near') {
    label = t('game.recordRemaining', lang);
    value = String(progress.remaining);
  } else if (progress.stage === 'post_record') {
    label = t('game.recordLead', lang);
    value = `+${progress.lead}`;
  }

  if (!label) return null;

  const emphasized = stage === 'near' || stage === 'record_broken';
  const accessibilityLabel = value ? `${label} ${value}` : label;

  return (
    <Animated.View
      key={`${stage}-${value ?? label}`}
      testID="hud-record-status"
      entering={badgeAnimation(reducedMotion)}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={{
        maxWidth: 164,
        height: 24,
        paddingHorizontal: 10,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: emphasized ? 'rgba(83,58,10,0.78)' : 'rgba(12,35,76,0.70)',
        borderWidth: 1,
        borderColor: emphasized ? 'rgba(255,216,90,0.72)' : 'rgba(255,224,133,0.34)',
      }}
    >
      <AppText
        testID="hud-record-status-text"
        preset="speech"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={{
          maxWidth: 144,
          color: emphasized ? '#FFF2B0' : '#DCEAFF',
          fontFamily: 'Fredoka_600SemiBold',
          fontSize: 14,
          lineHeight: 17,
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
        }}
      >
        {label}{value ? ` ${value}` : ''}
      </AppText>
    </Animated.View>
  );
}
