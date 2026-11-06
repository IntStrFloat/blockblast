import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '../AppText';
import { nightCandy as n } from '../nightCandy';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type Variant = 'primary' | 'ghost' | 'danger' | 'sky' | 'mandarin' | 'grape' | 'ink' | 'text';
const variants = {
  primary: { fill: n.sun, edge: n.sunEdge, ink: n.sunInk },
  sky: { fill: n.sky, edge: n.skyEdge, ink: '#082A4D' },
  mandarin: { fill: n.mandarin, edge: n.mandarinEdge, ink: '#3A1600' },
  grape: { fill: n.grape, edge: n.grapeEdge, ink: '#1E0A4D' },
  ink: { fill: '#3B2400', edge: '#6D4A0A', ink: '#FFFFFF' },
  ghost: { fill: 'rgba(255,255,255,0.10)', edge: 'transparent', ink: n.white },
  danger: { fill: 'rgba(255,79,106,0.12)', edge: 'transparent', ink: n.coral },
  text: { fill: 'transparent', edge: 'transparent', ink: n.muted },
} as const;

interface GameButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GameButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon,
  style,
}: GameButtonProps) {
  const pressed = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * 3 }] }));
  const { fill, edge, ink } = variants[variant];
  const solid = ['primary', 'sky', 'mandarin', 'grape', 'ink'].includes(variant);
  const height = size === 'lg' ? 58 : size === 'sm' ? 44 : 50;
  const radius = size === 'lg' ? 18 : 16;
  return (
    <View
      style={[
        { minHeight: height, marginBottom: solid ? 5 : 0, opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      {solid && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            bottom: -5,
            borderRadius: radius,
            backgroundColor: edge,
          }}
        />
      )}
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withTiming(1, {
            duration: n.motion.tap,
            easing: Easing.out(Easing.quad),
          });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, {
            duration: n.motion.tap,
            easing: Easing.out(Easing.quad),
          });
        }}
        style={[
          {
            minHeight: height,
            borderRadius: radius,
            backgroundColor: fill,
            borderWidth: solid || variant === 'text' ? 0 : 2,
            borderColor: variant === 'danger' ? 'rgba(255,79,106,0.4)' : 'rgba(255,255,255,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: size === 'sm' ? 14 : 22,
            flexDirection: 'row',
            gap: 10,
            overflow: 'hidden',
          },
          faceStyle,
        ]}
      >
        {solid && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: radius,
              borderTopWidth: 2,
              borderTopColor: 'rgba(255,255,255,0.45)',
            }}
          />
        )}
        {icon}
        <AppText
          preset="button"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{
            color: ink,
            fontSize: size === 'lg' ? 18 : size === 'sm' ? 14 : 16,
            lineHeight: size === 'lg' ? 24 : 22,
            textAlign: 'center',
            flexShrink: 1,
          }}
        >
          {label}
        </AppText>
      </AnimatedPressable>
    </View>
  );
}
