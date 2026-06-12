import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** Screen shake доски: ±3px, 2 цикла, 180мс — только при 2+ линиях (спека 04). */
export function useShake() {
  const shakeX = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-3, { duration: 22 }),
      withTiming(3, { duration: 45 }),
      withTiming(-3, { duration: 45 }),
      withTiming(3, { duration: 45 }),
      withTiming(0, { duration: 22 }),
    );
  }, [shakeX]);

  return { shakeStyle, triggerShake };
}
