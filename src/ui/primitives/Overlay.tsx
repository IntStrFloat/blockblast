import { StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { colors, radii, spacing } from '../theme';

interface OverlayProps {
  children: ReactNode;
}

/** Полноэкранный затемняющий оверлей с карточкой по центру. */
export function Overlay({ children }: OverlayProps) {
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.scrim}>
      <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.card}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
    zIndex: 100,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.card,
    backgroundColor: '#16244480',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.l,
    gap: spacing.m,
    backfaceVisibility: 'hidden',
  },
});
