import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppText, colors, radii, spacing } from '@/ui';

interface SpeechBubbleProps {
  text: string;
}

/**
 * Небольшой «пузырь» реплики Капи: скруглённый блок с хвостиком снизу.
 * Появление/исчезновение через FadeIn/FadeOut. Родитель монтирует пузырь
 * только когда есть текст. Переиспользуется для интро (поздняя задача).
 */
export function SpeechBubble({ text }: SpeechBubbleProps) {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.root}>
      <View style={styles.bubble}>
        <AppText preset="caption">{text}</AppText>
      </View>
      <View style={styles.tail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  bubble: {
    maxWidth: 200,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.card,
    backgroundColor: colors.cardGlass,
  },
  tail: {
    width: 12,
    height: 12,
    marginTop: -6,
    backgroundColor: colors.cardGlass,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
});
