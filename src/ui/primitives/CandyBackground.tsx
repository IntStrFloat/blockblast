import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Block } from '@/features/game/components/Block';
import { nightCandy as n } from '../nightCandy';

const decorations = [
  [18, 140, 34, -14, 0.22, 0],
  [320, 96, 26, 12, 0.2, 3],
  [300, 300, 40, -8, 0.18, 4],
  [30, 420, 28, 18, 0.18, 2],
  [330, 560, 30, -16, 0.16, 5],
  [40, 660, 24, 10, 0.16, 6],
] as const;

export const CandyBackground = memo(function CandyBackground({
  decorated = false,
  adventure = false,
}: {
  decorated?: boolean;
  adventure?: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="night" cx="50%" cy="0%" rx="120%" ry="55%">
            <Stop offset="0" stopColor="#2A37B0" />
            <Stop offset="0.48" stopColor="#161C66" />
            <Stop offset="1" stopColor={n.night900} />
          </RadialGradient>
          {adventure ? (
            <RadialGradient
              id="adventure-warm"
              cx="50%"
              cy="100%"
              rx="80%"
              ry="35%"
            >
              <Stop offset="0" stopColor="#FF8A2A" stopOpacity={0.3} />
              <Stop offset="0.7" stopColor="#FF8A2A" stopOpacity={0} />
            </RadialGradient>
          ) : null}
        </Defs>
        <Rect width="100%" height="100%" fill="url(#night)" />
        {adventure ? (
          <Rect width="100%" height="100%" fill="url(#adventure-warm)" />
        ) : null}
      </Svg>
      {decorated &&
        decorations.map(([x, y, size, rotation, opacity, color], i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${x / 3.9}%`,
              top: y,
              opacity,
              transform: [{ rotate: `${rotation}deg` }],
            }}
          >
            <Block size={size} color={n.blockColors[color]} />
          </View>
        ))}
    </View>
  );
});
