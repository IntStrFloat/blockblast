import { memo } from 'react';
import { View } from 'react-native';

import { radii } from '@/ui';

interface BlockProps {
  size: number;
  color: string;
}

/** Глянцевый блок: базовый цвет + светлая кромка сверху + тень снизу. */
export const Block = memo(function Block({ size, color }: BlockProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.cell,
        backgroundColor: color,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(2, Math.round(size * 0.16)),
          backgroundColor: 'rgba(255,255,255,0.16)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: Math.max(2, Math.round(size * 0.08)),
          backgroundColor: 'rgba(0,0,0,0.12)',
        }}
      />
    </View>
  );
});
