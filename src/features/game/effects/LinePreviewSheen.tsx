import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { DragCtx } from '../drag/DragContext';

export function useLinePreviewPulse(
  preview: SharedValue<number[]>,
  reduced: boolean,
) {
  const phase = useSharedValue(0);
  useAnimatedReaction(
    () => {
      if (reduced) return false;
      const mask = preview.value;
      for (let i = 0; i < 64; i++) if ((mask[i] & 2) !== 0) return true;
      return false;
    },
    (active, previous) => {
      if (active === previous) return;
      cancelAnimation(phase);
      phase.value = 0;
      if (active)
        phase.value = withRepeat(
          withTiming(1, { duration: 1000, easing: Easing.linear }),
          -1,
          false,
        );
    },
    [reduced],
  );
  return phase;
}

function LineShine({
  index,
  vertical,
  ctx,
  phase,
  reduced,
}: {
  index: number;
  vertical: boolean;
  ctx: DragCtx;
  phase: SharedValue<number>;
  reduced: boolean;
}) {
  const { cell, gap, boardSize } = ctx.geom;
  const preview = ctx.preview;
  const opacity = useAnimatedStyle(() => {
    if (reduced) return { opacity: 0 };
    const mask = preview.value;
    for (let i = 0; i < 8; i++) {
      if ((mask[vertical ? i * 8 + index : index * 8 + i] & 2) === 0)
        return { opacity: 0 };
    }
    return { opacity: 1 };
  });
  const beam = useAnimatedStyle(() => ({
    transform: [
      vertical
        ? { translateY: -60 + (boardSize + 120) * phase.value }
        : { translateX: -60 + (boardSize + 120) * phase.value },
      { rotate: '-20deg' },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: vertical ? index * (cell + gap) : 0,
          top: vertical ? 0 : index * (cell + gap),
          width: vertical ? cell : boardSize,
          height: vertical ? boardSize : cell,
          overflow: 'hidden',
          borderRadius: cell * 0.22,
        },
        opacity,
      ]}
    >
      <Animated.View
        style={[
          {
            width: vertical ? cell * 2 : 32,
            height: vertical ? 32 : cell * 2,
            left: vertical ? -cell / 2 : 0,
            top: vertical ? 0 : -cell / 2,
            backgroundColor: 'rgba(255,255,255,.28)',
          },
          beam,
        ]}
      />
    </Animated.View>
  );
}

/** Only sixteen clipped strips, sharing a single UI-thread clock for all cells. */
export function LinePreviewSheen({
  ctx,
  phase,
  reduced,
}: {
  ctx: DragCtx;
  phase: SharedValue<number>;
  reduced: boolean;
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: 16 }, (_, i) => (
        <LineShine
          key={i}
          index={i % 8}
          vertical={i >= 8}
          ctx={ctx}
          phase={phase}
          reduced={reduced}
        />
      ))}
    </View>
  );
}
