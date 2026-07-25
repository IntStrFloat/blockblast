import { View } from 'react-native';

import { useGameStore } from '@/features/game';
import { idx } from '@/core/engine';

import { JewelIcon } from './JewelIcon';

interface Props {
  cell: number;
  gap: number;
  /** Отступ сетки клеток от угла обёртки (рамка BoardView). */
  offset?: number;
}

const EMPTY_JEWELS: number[] = [];

export function JewelBoardLayer({ cell, gap, offset = 0 }: Props) {
  const jewels = useGameStore((s) => s.adventure?.jewelsOnBoard ?? EMPTY_JEWELS);
  if (jewels.length === 0) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: offset }}>
      {jewels.map((cellIndex) => {
        const row = Math.floor(cellIndex / 8);
        const col = cellIndex % 8;
        return (
          <View
            key={`${cellIndex}-${idx(row, col)}`}
            style={{
              position: 'absolute',
              left: col * (cell + gap),
              top: row * (cell + gap),
              width: cell,
              height: cell,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <JewelIcon size={cell} />
          </View>
        );
      })}
    </View>
  );
}
