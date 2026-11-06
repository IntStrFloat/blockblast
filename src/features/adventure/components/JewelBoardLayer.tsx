import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useGameStore } from '@/features/game/store';
import { useDragCtx } from '@/features/game/drag/DragContext';
import { Block } from '@/features/game/components/Block';
import { JewelIcon } from './JewelIcon';

const EMPTY_JEWELS: number[] = [];
function JewelCell({ index, cell, gap }: { index: number; cell: number; gap: number }) {
  const { noMovesWave } = useDragCtx();
  const row = Math.floor(index / 8);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, Math.min(1, (noMovesWave?.value ?? 0) * 8 - (7 - row))),
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: (index % 8) * (cell + gap),
          top: row * (cell + gap),
          width: cell,
          height: cell,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: cell * 0.22,
          boxShadow: '0px 0px 0px 2px #FFF1AF, 0px 0px 12px rgba(255,201,60,0.4)',
        }}
      >
        <Block size={cell} color="#FFD43F" />
      </View>
      <JewelIcon size={cell * 0.56} />
    </Animated.View>
  );
}

export function JewelBoardLayer({
  cell,
  gap,
  offset = 0,
}: {
  cell: number;
  gap: number;
  offset?: number;
}) {
  const jewels = useGameStore((s) => s.adventure?.jewelsOnBoard ?? EMPTY_JEWELS);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: offset }}>
      {jewels.map((index) => (
        <JewelCell key={index} index={index} cell={cell} gap={gap} />
      ))}
    </View>
  );
}
