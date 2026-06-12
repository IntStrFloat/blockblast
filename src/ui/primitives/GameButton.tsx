import { Pressable } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText } from '../AppText';
import { colors, radii, spacing } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'ghost' | 'danger';

const variantStyle: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.accent },
  ghost: { backgroundColor: colors.surface },
  danger: { backgroundColor: 'rgba(255,90,95,0.16)' },
};

const variantText: Record<Variant, string> = {
  primary: '#1B2A4A',
  ghost: colors.textPrimary,
  danger: colors.danger,
};

interface GameButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GameButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: GameButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      style={[
        {
          borderRadius: radii.button,
          paddingVertical: 14,
          paddingHorizontal: spacing.l,
          alignItems: 'center',
          opacity: disabled ? 0.4 : 1,
        },
        variantStyle[variant],
        animatedStyle,
        style,
      ]}
    >
      <AppText preset="button" style={{ color: variantText[variant] }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
