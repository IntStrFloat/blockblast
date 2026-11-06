import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useDragCtx } from '../drag/DragContext';
import { useGameStore } from '../store';

/** Pointer is visual only; it never captures a drag or places a piece. */
export function HintTarget({ pulse, reduced }: { pulse: SharedValue<number>; reduced: boolean }) {
  const ctx = useDragCtx();
  const hint = useGameStore((s) => s.helperHint);
  const piece = useGameStore((s) => hint ? s.game.tray[hint.trayIndex] : null);
  const { cell, gap, boardSize } = ctx.geom;
  const step = cell + gap;
  const x = hint && piece ? (hint.c + piece.shape.w / 2) * step - gap / 2 : 0;
  const y = hint && piece ? (hint.r + piece.shape.h / 2) * step - gap / 2 : 0;
  const dragActive = ctx.dragActive;
  const landingActive = ctx.handoff?.active;
  const motion = useAnimatedStyle(() => ({
    opacity: dragActive.value || landingActive?.value ? 0 : 1,
    transform: [{ translateY: reduced ? 0 : pulse.value * 5 }],
  }));
  if (!hint || !piece) return null;
  return (
    <Animated.View pointerEvents="none" testID="helper-hint-target" accessibilityElementsHidden
      style={[{ position: 'absolute', left: Math.max(0, Math.min(boardSize - 36, x - 15)),
        top: Math.max(0, Math.min(boardSize - 40, y - 4)), width: 36, height: 36 }, motion]}>
      <Svg width={36} height={36} viewBox="0 0 24 24" fill="#0B0E2E" stroke="#FFFFFF"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11M12 10V4a1.5 1.5 0 0 1 3 0v7M15 10.5V6.5a1.5 1.5 0 0 1 3 0v8a6.5 6.5 0 0 1-6.5 6.5h-.8a6 6 0 0 1-4.6-2.2L3.6 15a1.6 1.6 0 0 1 2.4-2.1L9 15.5" />
      </Svg>
    </Animated.View>
  );
}
