import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProgression } from '@/features/progression';
import { RewardVisual } from '@/features/progression/components/RewardVisual';
import { rewardDisplayName } from '@/features/progression/logic/presentation';
import { useLang } from '@/features/settings';
import { AppText, CandyIcon, nightCandy as n } from '@/ui';

import { useMascotFeedback } from '../hooks/useMascotFeedback';

/** A reward toast cannot intercept the next-game button beneath it. */
export function LevelUpReveal({
  hidden = false,
  top,
  width,
}: {
  hidden?: boolean;
  top?: number;
  width?: number;
}) {
  const reveal = useProgression((s) => s.reveal);
  const clearReveal = useProgression((s) => s.clearReveal);
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const { onLevelUp } = useMascotFeedback();

  useEffect(() => {
    if (reveal === null || hidden) return;
    onLevelUp();
    const timer = setTimeout(clearReveal, 1300);
    return () => clearTimeout(timer);
  }, [reveal, clearReveal, hidden, onLevelUp]);

  if (reveal === null || hidden) return null;
  const label = `${lang === 'ru' ? 'Уровень' : 'Level'} ${reveal.level}. ${reveal.rewards.map((reward) => rewardDisplayName(reward, lang)).join(', ')}`;

  return (
    <View
      testID="level-up-reveal"
      pointerEvents="box-none"
      style={[
        styles.host,
        { top: top ?? insets.top + 12 },
        width === undefined
          ? undefined
          : { width, left: undefined, right: undefined, alignSelf: 'center' },
      ]}
    >
      <Animated.View
        entering={FadeIn.duration(160)}
        style={{ maxWidth: '100%' }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={lang === 'ru' ? 'Скрыть' : 'Dismiss'}
          accessibilityLiveRegion="polite"
          onPress={clearReveal}
          style={styles.toast}
        >
          <CandyIcon name="crown" size={20} color={n.sun} />
          <AppText
            preset="button"
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            style={styles.level}
          >
            {reveal.level}
          </AppText>
          {reveal.rewards.slice(0, 3).map((reward, index) => (
            <RewardVisual key={index} reward={reward} size={36} />
          ))}
          {reveal.rewards.length > 3 ? (
            <AppText preset="caption" style={styles.level}>
              +{reveal.rewards.length - 3}
            </AppText>
          ) : null}
          <CandyIcon name="check" size={22} color={n.mint} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 200,
  },
  toast: {
    minHeight: 56,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    backgroundColor: n.night850,
    borderWidth: 1,
    borderColor: n.sun,
  },
  level: { color: '#FFFFFF', fontVariant: ['tabular-nums'] },
});
