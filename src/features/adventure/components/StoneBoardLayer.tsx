import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useGameStore } from '@/features/game/store';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';

const EMPTY: Record<number, 1 | 2> = {};
function Stone({ hits, size, x, y }: { hits: 1 | 2; size: number; x: number; y: number }) {
  const previous = useRef(hits);
  const shake = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (hits < previous.current && !reduced)
      shake.value = withSequence(
        withTiming(-3, { duration: 35 }),
        withTiming(3, { duration: 45 }),
        withTiming(0, { duration: 60 }),
      );
    previous.current = hits;
  }, [hits, reduced, shake]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  return (
    <Animated.View
      accessible
      accessibilityLabel={`Камень: ${hits} ${hits === 1 ? 'удар' : 'удара'} до разрушения`}
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size * 0.22,
          backgroundColor: '#7F84A7',
          borderTopWidth: 3,
          borderTopColor: '#B0B4CF',
          borderBottomWidth: 4,
          borderBottomColor: '#64698C',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 40 40">
        <Path
          d={hits === 2 ? 'M10 14l14-5M20 22l10 5' : 'M10 14l14-5-6 12 12 6M18 21l-8 10M18 21l10-3'}
          stroke="#565B7E"
          strokeWidth={2}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
export function StoneBoardLayer({
  cell,
  gap,
  offset = 8,
}: {
  cell: number;
  gap: number;
  offset?: number;
}) {
  const stones = useGameStore((s) => s.adventure?.stonesOnBoard ?? EMPTY);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: offset }}>
      {Object.entries(stones).map(([key, hits]) => {
        const index = Number(key);
        return (
          <Stone
            key={key}
            hits={hits}
            size={cell}
            x={(index % 8) * (cell + gap)}
            y={Math.floor(index / 8) * (cell + gap)}
          />
        );
      })}
    </View>
  );
}
