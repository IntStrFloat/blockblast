import { useEffect } from 'react';
import { cancelAnimation, Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** One UI clock per visible hint layer, never per cell or per animation frame. */
export function useHintPulse(active: boolean, reduced: boolean) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 1;
    if (active && !reduced)
      pulse.value = withRepeat(withTiming(0, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [active, pulse, reduced]);
  return pulse;
}
