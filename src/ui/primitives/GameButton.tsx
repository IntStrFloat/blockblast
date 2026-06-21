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

type Size = 'md' | 'lg';

interface GameButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GameButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  style,
}: GameButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const lg = size === 'lg';

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
          paddingVertical: lg ? 20 : 14,
          paddingHorizontal: spacing.l,
          alignItems: 'center',
          opacity: disabled ? 0.4 : 1,
          // «Глиняная» приподнятость для главного действия.
          shadowColor: colors.clayShadow,
          shadowOffset: { width: 0, height: lg ? 8 : 4 },
          shadowOpacity: lg ? 0.45 : 0.3,
          shadowRadius: lg ? 12 : 8,
          elevation: lg ? 6 : 3,
        },
        variantStyle[variant],
        animatedStyle,
        style,
      ]}
    >
      <AppText
        preset="button"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ color: variantText[variant], fontSize: lg ? 19 : 15 }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
