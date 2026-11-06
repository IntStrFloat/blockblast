import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function BoardDangerFrame({
  active,
  reduced,
}: {
  active: boolean;
  reduced: boolean;
}) {
  const phase = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(phase);
    phase.value = active ? (reduced ? 0.7 : 0) : 0;
    if (active && !reduced)
      phase.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    return () => cancelAnimation(phase);
  }, [active, phase, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: active ? 0.15 + phase.value * 0.85 : 0,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          inset: -8,
          borderRadius: 18,
          borderWidth: 3,
          borderColor: '#FF4F6A',
          boxShadow: '0 0 26px rgba(255,79,106,.7)',
        },
        style,
      ]}
    />
  );
}
