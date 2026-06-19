import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CandyGlyph } from './MascotArt';

interface FeedPromptProps {
  onPress: () => void;
}

/**
 * Небольшая кнопка «угощение» с мягким подбоем — появляется над маскотом,
 * когда кормление доступно. При нажатии срабатывает onPress.
 */
export function FeedPrompt({ onPress }: FeedPromptProps) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 700 }),
        withTiming(0, { duration: 700 }),
      ),
      -1, // бесконечно
      false,
    );
    return () => {
      cancelAnimation(bob);
      bob.value = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={bobStyle}>
      <Pressable
        onPress={onPress}
        style={styles.hit}
        accessibilityLabel="Покормить маскота"
        accessibilityRole="button"
      >
        <CandyGlyph size={24} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
