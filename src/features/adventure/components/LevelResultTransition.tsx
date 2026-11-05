import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion } from '@/features/game/animation/useReducedMotion';

/** Start from a laid-out native surface so mounting the result cannot eat its entrance. */
export function LevelResultTransition({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const started = useRef(false);
  const mounted = useRef(true);
  const announced = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimation(progress);
    };
  }, [progress]);
  const announceReady = useCallback(() => {
    if (!mounted.current || announced.current) return;
    announced.current = true;
    onReadyRef.current?.();
  }, []);
  const onLayout = useCallback(() => {
    if (started.current) return;
    started.current = true;
    progress.set(withTiming(1, {
      duration: reduced ? 140 : 280,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    }, (finished) => {
      if (finished) scheduleOnRN(announceReady);
    }));
  }, [announceReady, progress, reduced]);
  const style = useAnimatedStyle(() => {
    const value = progress.get();
    return {
      opacity: value,
      transform: [
        { translateY: reduced ? 0 : 18 * (1 - value) },
        { scale: reduced ? 1 : 0.97 + 0.03 * value },
      ],
    };
  });
  return (
    <Animated.View
      testID="adventure-result-transition"
      collapsable={false}
      onLayout={onLayout}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}
