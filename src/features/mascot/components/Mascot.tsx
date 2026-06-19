import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { Slot, Stage } from '../logic/types';
import { MascotFigure } from './MascotArt';

export interface MascotMotion {
  x: SharedValue<number>;
  bob: SharedValue<number>;
  scaleX: SharedValue<number>;
  scaleY: SharedValue<number>;
  facing: SharedValue<number>;
  rotate: SharedValue<number>;
  eyeOpen: SharedValue<number>;
  opacity: SharedValue<number>;
}

export function useMascotMotion(): MascotMotion {
  return {
    x: useSharedValue(0),
    bob: useSharedValue(0),
    scaleX: useSharedValue(1),
    scaleY: useSharedValue(1),
    facing: useSharedValue(1),
    rotate: useSharedValue(0),
    eyeOpen: useSharedValue(1),
    opacity: useSharedValue(1),
  };
}

export interface MascotProps {
  motion: MascotMotion;
  stage: Stage;
  equipped?: Partial<Record<Slot, string>>;
  size?: number;
}

export function Mascot({ motion, stage, equipped, size = 60 }: MascotProps) {
  const { bob, scaleX, scaleY, facing, rotate, eyeOpen, opacity } = motion;

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: bob.value },
      { rotate: `${rotate.value}deg` },
      { scaleX: scaleX.value * facing.value },
      { scaleY: scaleY.value },
    ],
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeOpen.value }],
  }));

  return (
    <Animated.View style={[styles.root, { width: size, height: size }, containerStyle]}>
      <MascotFigure stage={stage} equipped={equipped} size={size} eyeStyle={eyeStyle} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
