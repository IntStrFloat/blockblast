import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/ui';

export interface TutorialPoint {
  x: number;
  y: number;
}

interface TutorialPointerProps {
  from: TutorialPoint;
  to: TutorialPoint;
  reducedMotion?: boolean;
  emphasized?: boolean;
}

function PointerGlyph({ emphasized }: { emphasized: boolean }) {
  return (
    <Svg width={52} height={62} viewBox="0 0 52 62" fill="none" accessibilityElementsHidden>
      <Circle cx="19" cy="16" r={emphasized ? 12 : 9} fill="rgba(255,201,60,0.18)" />
      <Path
        d="M18 7c-3 0-5 2.3-5 5.2v18.1l-3.2-3.4a5 5 0 0 0-7.2 6.9l12.6 14.4A12 12 0 0 0 24.3 52H31c8.3 0 15-6.7 15-15V25.5a4.5 4.5 0 0 0-8.1-2.7 4.7 4.7 0 0 0-8-3 4.8 4.8 0 0 0-6.9-3.4v-4.2C23 9.3 21 7 18 7Z"
        fill="#FFF7EE"
        stroke="#2A1E2B"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <Path d="M23 17v13M30 20v10M38 23v8" stroke="#C98650" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** Purely visual vector guidance: this entire layer is transparent to game gestures. */
export function TutorialPointer({
  from,
  to,
  reducedMotion = false,
  emphasized = false,
}: TutorialPointerProps) {
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? 1
      : withRepeat(
          withSequence(
            withTiming(0, { duration: 500 }),
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
            withTiming(1, { duration: 900 }),
            withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
            withTiming(0, { duration: 500 }),
          ),
          -1,
          false,
        );
  }, [progress, reducedMotion]);

  const pointerStyle = useAnimatedStyle(() => ({
    // Quadratic arc: the hand leaves the actual piece, bends slightly upward,
    // then settles into the highlighted cells instead of travelling as a ruler line.
    // The tip of the SVG hand is kept on the sampled path, not its bounding box.
    transform: (() => {
      const t = progress.value;
      const controlX = from.x + (to.x - from.x) * 0.48 + (to.y - from.y) * 0.16;
      const controlY = from.y + (to.y - from.y) * 0.42 - (to.x - from.x) * 0.12;
      const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * controlX + t * t * to.x;
      const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * controlY + t * t * to.y;
      return [
        { translateX: x - 18 },
        { translateY: y - 7 },
        { scale: emphasized ? 1.08 : 1 },
      ];
    })(),
    opacity: reducedMotion ? 0.92 : 0.35 + progress.value * 0.65,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.pointer, pointerStyle]}>
        <PointerGlyph emphasized={emphasized} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pointer: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 52,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
});
