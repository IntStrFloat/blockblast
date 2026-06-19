import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { AppText, radii, spacing } from '@/ui';

interface ReviveButtonProps {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}

function VideoAdIcon() {
  return (
    <View style={styles.iconShell}>
      <Svg width={30} height={30} viewBox="0 0 30 30" fill="none">
        <Rect x="3.5" y="6.5" width="23" height="18" rx="4" stroke="#FFFFFF" strokeWidth="2.4" />
        <Path d="M13 11.5v7l6-3.5-6-3.5z" fill="#FFFFFF" />
        <Path d="M9 3.5v3M15 3.5v3M21 3.5v3" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export function ReviveButton({ label, disabled = false, onPress }: ReviveButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shadow,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={['#43E45F', '#16A82D']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.surface}
      >
        <VideoAdIcon />
        <AppText preset="button" style={styles.label}>
          {label}
        </AppText>
        <View style={styles.balance} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radii.button,
    backgroundColor: '#087D20',
    shadowColor: '#0AF43A',
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  surface: {
    minHeight: 62,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    paddingHorizontal: spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  iconShell: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,91,20,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  label: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 17,
    textShadowColor: 'rgba(0,70,15,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  balance: {
    width: 42,
  },
  disabled: {
    opacity: 0.44,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: {
    transform: [{ translateY: 2 }, { scale: 0.985 }],
    shadowOpacity: 0.18,
    elevation: 3,
  },
});
