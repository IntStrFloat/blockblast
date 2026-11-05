import { useEffect, useState } from 'react';
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

export function RecordStatusBadge({ compact = false }: { compact?: boolean }) {
  const score = useGameStore((s) => s.game.score);
  const combo = useGameStore((s) => s.game.combo);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const recordCelebration = useGameStore((s) => s.recordCelebration);
  const lang = useLang();
  const reducedMotion = useReducedMotion();
  const [retiredRecord, setRetiredRecord] = useState<typeof recordCelebration>(null);
  const showRecordTitle = recordCelebration !== null && retiredRecord !== recordCelebration;

  useEffect(() => {
    if (!recordCelebration) return;
    const timer = setTimeout(() => setRetiredRecord(recordCelebration),
      reducedMotion ? 420 : RECORD_PROGRESS.celebrationMs);
    return () => clearTimeout(timer);
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
  const visibleText = compact && value
    ? `${t('game.best', lang)}\n${stage === 'post_record' ? value : `−${value}`}`
    : accessibilityLabel;

  return (
    <Animated.View
      key={`${stage}-${value ?? label}`}
      testID="hud-record-status"
      entering={badgeAnimation(reducedMotion)}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={{
        maxWidth: '100%',
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
        numberOfLines={2}
        allowFontScaling={false}
        style={{
          maxWidth: '100%',
          color: emphasized ? '#FFF2B0' : '#DCEAFF',
          fontFamily: 'Unbounded_700Bold',
          fontSize: 11,
          lineHeight: 12,
          includeFontPadding: false,
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
        }}
      >
        {visibleText}
      </AppText>
    </Animated.View>
  );
}
