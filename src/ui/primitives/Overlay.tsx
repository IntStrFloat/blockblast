import { useEffect, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { nightCandy as n } from '../nightCandy';

interface OverlayProps {
  children: ReactNode;
  onDismiss?: () => void;
}

/** The single modal surface: rounded bottom sheet, handle, scrim and back action. */
export function Overlay({ children, onDismiss }: OverlayProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss?.();
      return true;
    });
    return () => sub.remove();
  }, [onDismiss]);
  const drag = Gesture.Pan()
    .enabled(!!onDismiss)
    .activeOffsetY(8)
    .onUpdate((e) => {
      offset.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if ((e.translationY > 70 || e.velocityY > 600) && onDismiss)
        scheduleOnRN(onDismiss);
      else
        offset.value = withTiming(0, {
          duration: n.motion.sheet,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        });
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  return (
    <Animated.View
      collapsable={false}
      exiting={reduced ? undefined : FadeOut.duration(0).delay(n.motion.sheet)}
      importantForAccessibility="yes"
      style={styles.scrim}
    >
      <Animated.View
        pointerEvents="none"
        entering={reduced ? undefined : FadeIn.duration(140)}
        exiting={reduced ? undefined : FadeOut.duration(140)}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(5,7,31,0.70)' },
        ]}
      />
      <Pressable
        accessible={false}
        onPress={onDismiss}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        entering={
          reduced
            ? undefined
            : SlideInDown.duration(n.motion.sheet).easing(
                Easing.bezier(0.22, 1, 0.36, 1),
              )
        }
        exiting={reduced ? undefined : SlideOutDown.duration(n.motion.sheet)}
        style={{ width: '100%', maxWidth: 520 }}
      >
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={onDismiss}
          importantForAccessibility="yes"
          style={[
            styles.card,
            { paddingBottom: Math.max(34, insets.bottom + 10) },
            style,
          ]}
        >
          <GestureDetector gesture={drag}>
            <View accessible={false} style={styles.handleArea}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
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
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  card: {
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: n.night800,
    borderTopWidth: 2,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 20,
    paddingTop: 0,
    gap: 16,
  },
  handleArea: {
    height: 17,
    paddingTop: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(200,205,251,0.4)',
  },
});
