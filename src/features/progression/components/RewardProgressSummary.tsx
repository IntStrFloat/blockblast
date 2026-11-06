import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useLang } from '@/features/settings';
import { AppText } from '@/ui/AppText';
import { CandyCapy } from '@/ui/primitives/CandyCapy';
import { nightCandy as n } from '@/ui/nightCandy';
import { CheckIcon } from '@/ui/icons/CheckIcon';

import { progressFor, thresholdForLevel } from '../logic/levels';
import { rewardDisplayName } from '../logic/presentation';
import { nextRewardMilestone, rewardForLevel } from '../logic/rewards';
import { RewardVisual } from './RewardVisual';

interface RewardProgressSummaryProps {
  earnedXp: number;
  lifetimePoints: number;
  light?: boolean;
}

export function RewardProgressSummary({
  earnedXp,
  lifetimePoints,
  light = false,
}: RewardProgressSummaryProps) {
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
    ? `${rewardDisplayName(next.reward, lang)} · ${
        next.available
          ? lang === 'ru'
            ? 'открыто'
            : 'unlocked'
          : lang === 'ru'
            ? `ещё ${next.remaining} XP`
            : `${next.remaining} XP left`
      }`
    : lang === 'ru'
      ? 'Все награды открыты'
      : 'All rewards unlocked';
  const accessibleLabel =
    lang === 'ru'
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
        <CandyCapy size={32} />
        <AppText style={styles.earned}>
          {lang === 'ru' ? `Капи +${earned} опыта` : `Capy +${earned} XP`}
        </AppText>
        <AppText style={styles.destination}>
          {lang === 'ru' ? 'Ранг' : 'Rank'} {after.level}
          {next && next.level > after.level ? ` → ${next.level}` : ''}
        </AppText>
      </View>
      <View style={styles.row}>
        <View
          style={styles.track}
          testID="reward-progress-track"
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
        >
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <View style={styles.reward} testID="reward-progress-item">
          {next ? (
            <RewardVisual reward={next.reward} size={32} />
          ) : (
            <CheckIcon size={28} color={n.sun} />
          )}
          {next?.available ? (
            <View style={styles.unlocked}>
              <CheckIcon size={12} color="#153B37" />
            </View>
          ) : null}
        </View>
      </View>
      <AppText style={styles.detail}>
        {next && !next.available
          ? lang === 'ru'
            ? `Ещё ${next.remaining} опыта — и Капи получит ${rewardDisplayName(next.reward, lang).toLowerCase()}`
            : `${next.remaining} XP until ${rewardDisplayName(next.reward, lang)}`
          : rewardLabel}
      </AppText>
      {expanded ? <AppText style={styles.detail}>{accessibleLabel}</AppText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 16,
    gap: 12,
    borderRadius: 24,
    backgroundColor: '#161C59',
    borderWidth: 1.5,
    borderColor: 'rgba(200,205,251,0.18)',
  },
  cardLight: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  earned: { color: '#FFFFFF', fontFamily: 'Nunito_900Black', fontSize: 16, flex: 1 },
  destination: { color: n.grape, fontFamily: 'Nunito_900Black', fontSize: 13 },
  track: {
    flex: 1,
    height: 12,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: '#0B0F42',
    borderTopWidth: 2,
    borderTopColor: 'rgba(0,0,0,0.25)',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 99,
    backgroundColor: n.grape,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255,255,255,0.45)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  reward: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2174',
    borderWidth: 2,
    borderColor: n.grape,
  },
  unlocked: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    padding: 2,
    borderRadius: 8,
    backgroundColor: n.mint,
  },
  detail: { color: n.lavender, fontFamily: 'Nunito_800ExtraBold', fontSize: 13, lineHeight: 18 },
});
