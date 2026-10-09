import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProgression } from '@/features/progression';
import { RewardVisual } from '@/features/progression/components/RewardVisual';
import { rewardDisplayName } from '@/features/progression/logic/presentation';
import { useLang } from '@/features/settings';
import { AppText, CheckIcon, StarIcon } from '@/ui';

import { useMascotFeedback } from '../hooks/useMascotFeedback';

/** A reward toast cannot intercept the next-game button beneath it. */
export function LevelUpReveal() {
  const reveal = useProgression((s) => s.reveal);
  const clearReveal = useProgression((s) => s.clearReveal);
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const { onLevelUp } = useMascotFeedback();

  useEffect(() => {
    if (reveal === null) return;
    onLevelUp();
    const timer = setTimeout(clearReveal, 1300);
    return () => clearTimeout(timer);
  }, [reveal, clearReveal, onLevelUp]);

  if (reveal === null) return null;
  const label = `${lang === 'ru' ? 'Уровень' : 'Level'} ${reveal.level}. ${reveal.rewards.map((reward) => rewardDisplayName(reward, lang)).join(', ')}`;

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 12 }]}>
      <Animated.View entering={FadeIn.duration(160)}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={lang === 'ru' ? 'Скрыть' : 'Dismiss'} accessibilityLiveRegion="polite" onPress={clearReveal} style={styles.toast}>
          <StarIcon size={20} color="#FFE06B" />
          <AppText preset="button" style={styles.level}>{reveal.level}</AppText>
          {reveal.rewards.slice(0, 3).map((reward, index) => <RewardVisual key={index} reward={reward} size={36} />)}
          {reveal.rewards.length > 3 ? <AppText preset="caption" style={styles.level}>+{reveal.rewards.length - 3}</AppText> : null}
          <CheckIcon size={22} color="#8EEAA0" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 200 },
  toast: { minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, backgroundColor: '#123B62', borderWidth: 1, borderColor: 'rgba(255,224,107,0.7)' },
  level: { color: '#FFFFFF', fontVariant: ['tabular-nums'] },
});
