import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useLang } from '@/features/settings';
import { AppText } from '@/ui/AppText';
import { CheckIcon } from '@/ui/icons/CheckIcon';
import { StarIcon } from '@/ui/icons/StarIcon';
import { spacing } from '@/ui/theme';

import { progressFor, thresholdForLevel } from '../logic/levels';
import { rewardDisplayName } from '../logic/presentation';
import { nextRewardMilestone, rewardForLevel } from '../logic/rewards';
import { RewardVisual } from './RewardVisual';

interface RewardProgressSummaryProps {
  earnedXp: number;
  lifetimePoints: number;
  light?: boolean;
}

export function RewardProgressSummary({ earnedXp, lifetimePoints, light = false }: RewardProgressSummaryProps) {
  const lang = useLang();
  const [expanded, setExpanded] = useState(false);
  const earned = Math.max(0, Math.floor(earnedXp));
  const points = Math.max(0, lifetimePoints);
  const after = progressFor(points);
  const next = nextRewardMilestone(points);
  // The fill and its endpoint represent the same authored reward.
  let start = 0;
  for (let level = 1; next && level < next.level; level += 1) {
    if (rewardForLevel(level)) start = thresholdForLevel(level);
  }
  const target = next?.threshold ?? points;
  const span = Math.max(1, target - start);
  const ratio = !next || next.available ? 1 : Math.max(0, Math.min(1, (points - start) / span));
  const previousRatio = Math.max(0, Math.min(ratio, (points - earned - start) / span));
  const fill = useSharedValue(previousRatio);
  useEffect(() => {
    fill.value = withTiming(ratio, { duration: 280, easing: Easing.bezier(0.23, 1, 0.32, 1) });
  }, [fill, ratio]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const rewardLabel = next
    ? `${rewardDisplayName(next.reward, lang)} · ${next.available
      ? lang === 'ru' ? 'открыто' : 'unlocked'
      : lang === 'ru' ? `ещё ${next.remaining} XP` : `${next.remaining} XP left`}`
    : lang === 'ru' ? 'Все награды открыты' : 'All rewards unlocked';
  const accessibleLabel = lang === 'ru'
    ? `Получено ${earned} XP. Общий уровень ${after.level}. До уровня ${after.level + 1}: ${after.pointsToNext} XP. ${rewardLabel}`
    : `Earned ${earned} XP. Overall level ${after.level}. ${after.pointsToNext} XP to level ${after.level + 1}. ${rewardLabel}`;

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLiveRegion="polite"
      accessibilityLabel={accessibleLabel}
      accessibilityHint={lang === 'ru' ? 'Показать награду' : 'Show reward details'}
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      style={[styles.card, light && styles.cardLight]}
      testID="reward-progress-summary"
    >
      <View style={styles.row}>
        <View style={styles.levelBadge}>
          <StarIcon size={16} color="#FFE06B" />
          <AppText preset="button" style={styles.level}>{after.level}</AppText>
        </View>
        <View style={styles.progress}>
          <View style={styles.numbers}>
            <AppText preset="caption" style={styles.earned}>{earned > 0 ? `+${earned} XP` : 'XP'}</AppText>
            {next ? <AppText preset="caption" style={styles.destination}>{next.level}</AppText> : <CheckIcon size={16} color="#FFE06B" />}
          </View>
          <View style={styles.track} testID="reward-progress-track" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
        </View>
        <View style={styles.reward} testID="reward-progress-item">
          {next ? <RewardVisual reward={next.reward} size={36} /> : <CheckIcon size={28} color="#FFE06B" />}
          {next?.available ? <View style={styles.unlocked}><CheckIcon size={12} color="#153B37" /></View> : null}
        </View>
      </View>
      {expanded ? <AppText preset="caption" style={styles.detail}>{rewardLabel}</AppText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 360, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(14,44,102,0.65)' },
  cardLight: { backgroundColor: 'rgba(13,42,97,0.8)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelBadge: { minWidth: 42, alignItems: 'center', gap: 1 },
  level: { color: '#FFFFFF', fontSize: 20, fontVariant: ['tabular-nums'] },
  progress: { flex: 1, gap: 7 },
  numbers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earned: { color: '#FFE06B', fontWeight: '700', fontVariant: ['tabular-nums'] },
  destination: { color: '#D9EBFF', fontVariant: ['tabular-nums'] },
  track: { height: 10, overflow: 'hidden', borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)' },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 5, backgroundColor: '#FFE06B' },
  reward: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)' },
  unlocked: { position: 'absolute', right: -2, bottom: -2, padding: 2, borderRadius: 8, backgroundColor: '#8EEAA0' },
  detail: { paddingTop: spacing.s, color: '#F4FAFF', textAlign: 'center' },
});
