import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { JewelIcon } from '@/features/adventure/components/JewelIcon';
import { BlockShine } from '../components/Block';

interface LandingPiece {
  cells: readonly (readonly [number, number])[];
  jewels: readonly number[];
  color: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  width: number;
  height: number;
  scale: number;
}

export interface PlacementHandoff {
  /** Nonzero until the landing art has a native board/clear cover to hand over to. */
  active: SharedValue<number>;
  owner: SharedValue<number>;
  serial: SharedValue<number>;
  progress: SharedValue<number>;
  piece: SharedValue<LandingPiece>;
  pending: MutableRefObject<number>;
}

export function usePlacementHandoff(): PlacementHandoff {
  const active = useSharedValue(0);
  const owner = useSharedValue(-1);
  const serial = useSharedValue(0);
  const progress = useSharedValue(0);
  const piece = useSharedValue<LandingPiece>({
    cells: [],
    jewels: [],
    color: '#FFFFFF',
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    width: 0,
    height: 0,
    scale: 1,
  });
  const pending = useRef(0);
  return useMemo(
    () => ({ active, owner, serial, progress, piece, pending }),
    [active, owner, serial, progress, piece],
  );
}

function LandingCell({
  index,
  size,
  gap,
  handoff,
}: {
  index: number;
  size: number;
  gap: number;
  handoff: PlacementHandoff;
}) {
  const { active, progress, piece } = handoff;
  const style = useAnimatedStyle(() => {
    const data = piece.value;
    const cell = data.cells[index];
    if (!cell || !active.value) return { opacity: 0 };
    const p = progress.value;
    const travel = 1 - Math.pow(1 - Math.min(1, p / 0.55), 3);
    const scale = interpolate(
      p,
      [0, 0.55, 0.72, 0.88, 1],
      [data.scale, 0.9, 1.06, 0.98, 1],
    );
    const squashY = interpolate(
      p,
      [0, 0.55, 0.72, 0.88, 1],
      [data.scale, 1.08, 0.92, 1.02, 1],
    );
    const cx = data.fromX + (data.toX - data.fromX) * travel;
    const cy = data.fromY + (data.toY - data.fromY) * travel;
    return {
      opacity: 1,
      backgroundColor: data.jewels.includes(index) ? '#FFD43F' : data.color,
      transform: [
        {
          translateX:
            cx +
            (cell[1] * (size + gap) + size / 2 - data.width / 2) * scale -
            size / 2,
        },
        {
          translateY:
            cy +
            (cell[0] * (size + gap) + size / 2 - data.height / 2) * squashY -
            size / 2,
        },
        { scaleX: scale },
        { scaleY: squashY },
      ],
    };
  });
  const jewelStyle = useAnimatedStyle(() => ({
    opacity: active.value && piece.value.jewels.includes(index) ? 1 : 0,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          overflow: 'hidden',
          boxShadow: '0px 2px 0px rgba(5,8,40,0.35)',
        },
        style,
      ]}
    >
      <BlockShine size={size} />
      <Animated.View
        style={[
          {
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          jewelStyle,
        ]}
      >
        <JewelIcon size={size * 0.6} />
      </Animated.View>
    </Animated.View>
  );
}

/** Nine cells cover the largest legal piece. No mounting or React updates during a gesture. */
export function PlacementHandoffLayer({
  handoff,
  size,
  gap,
}: {
  handoff: PlacementHandoff;
  size: number;
  gap: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <LandingCell
          key={index}
          index={index}
          size={size}
          gap={gap}
          handoff={handoff}
        />
      ))}
    </View>
  );
}
