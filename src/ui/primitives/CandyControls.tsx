import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { AppText } from '../AppText';
import { CandyIcon, type CandyIconName } from '../icons/CandyIcon';
import { nightCandy as n } from '../nightCandy';

export function CandyRoundButton({
  icon,
  label,
  onPress,
  size = 48,
}: {
  icon: CandyIconName;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: 99,
        backgroundColor: pressed ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.12)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: pressed ? 2 : 0 }],
      })}
    >
      <CandyIcon name={icon} />
    </Pressable>
  );
}

export function CandyChip({
  icon,
  label,
  color = n.sun,
  height = 36,
}: {
  icon?: CandyIconName;
  label: string;
  color?: string;
  height?: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height,
        paddingLeft: 10,
        paddingRight: 14,
        borderRadius: 99,
        backgroundColor: 'rgba(6,9,44,0.55)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.14)',
      }}
    >
      {icon && <CandyIcon name={icon} size={18} color={color} />}
      <AppText preset="button" style={{ fontSize: 14, lineHeight: 20 }}>
        {label}
      </AppText>
    </View>
  );
}

export function CandyToggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(value ? 1 : 0, { duration: n.motion.tap });
  }, [on, value]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: on.value * 20 }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{
        width: 50,
        height: 30,
        padding: 3,
        backgroundColor: value ? n.mint : '#0C1044',
        borderRadius: 99,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Animated.View
        style={[{ width: 22, height: 22, borderRadius: 99, backgroundColor: n.white }, style]}
      />
    </Pressable>
  );
}
