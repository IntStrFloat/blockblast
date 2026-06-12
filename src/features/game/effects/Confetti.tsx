import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { BLOCK_THEMES } from '@/ui';

const COUNT = 24;

interface ConfettiProps {
  /** Высота зоны падения */
  height?: number;
  colors?: string[];
}

/** Конфетти нового рекорда: 24 частицы, 1.2с (спека 04). Монтировать по факту события. */
export function Confetti({ height = 360, colors }: ConfettiProps) {
  const palette = colors ?? BLOCK_THEMES[0].cellColors;

  const pieces = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        id: i,
        leftPct: Math.random() * 100,
        size: 6 + Math.random() * 6,
        color: palette[i % palette.length],
        delay: Math.round(Math.random() * 250),
        drift: (Math.random() - 0.5) * 80,
        rotate: `${Math.round((Math.random() - 0.5) * 540)}deg`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height,
        overflow: 'hidden',
      }}
    >
      {pieces.map((p) => {
        const kf = new Keyframe({
          0: {
            opacity: 1,
            transform: [{ translateY: -16 }, { translateX: 0 }, { rotate: '0deg' }],
          },
          80: {
            opacity: 1,
            transform: [
              { translateY: height * 0.8 },
              { translateX: p.drift * 0.8 },
              { rotate: p.rotate },
            ],
          },
          100: {
            opacity: 0,
            transform: [
              { translateY: height },
              { translateX: p.drift },
              { rotate: p.rotate },
            ],
          },
        })
          .duration(1200)
          .delay(p.delay);
        return (
          <Animated.View
            key={p.id}
            entering={kf}
            style={{
              position: 'absolute',
              left: `${p.leftPct}%`,
              top: 0,
              width: p.size,
              height: p.size * 0.6,
              borderRadius: 1,
              backgroundColor: p.color,
              opacity: 0,
            }}
          />
        );
      })}
    </View>
  );
}
