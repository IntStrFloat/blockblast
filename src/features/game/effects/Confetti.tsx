import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { BLOCK_THEMES } from '@/ui';

import { createSeedHasher, seededRandom } from '../animation/presentationMath';

const COUNT = 24;

export interface ConfettiPiece {
  id: number;
  leftPct: number;
  top: number;
  size: number;
  color: string;
  delay: number;
  drift: number;
  rotate: string;
  testID?: string;
}

interface BuildConfettiPiecesOptions {
  count?: number;
  height?: number;
  palette: readonly string[];
  reducedMotion?: boolean;
  seed?: number;
  testIdPrefix?: string;
}

interface ConfettiProps {
  height?: number;
  colors?: string[];
  palette?: string[];
  count?: number;
  pieces?: ConfettiPiece[];
  reducedMotion?: boolean;
  seed?: number;
  testIdPrefix?: string;
}

export function buildConfettiPieces({
  count = COUNT,
  height = 360,
  palette,
  reducedMotion = false,
  seed,
  testIdPrefix,
}: BuildConfettiPiecesOptions): ConfettiPiece[] {
  const hasher = createSeedHasher();
  hasher.feedNumber(seed ?? 0);
  hasher.feedNumber(count);
  hasher.feedNumber(height);
  palette.forEach((color) => hasher.feedString(color));
  const random = seededRandom(hasher.value());

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    leftPct: 4 + random() * 92,
    top: reducedMotion ? Math.round(height * (0.08 + random() * 0.26)) : 0,
    size: 6 + random() * 6,
    color: palette[i % palette.length] ?? '#FFFFFF',
    delay: Math.round(random() * (reducedMotion ? 90 : 250)),
    drift: reducedMotion ? 0 : (random() - 0.5) * 80,
    rotate: reducedMotion ? '0deg' : `${Math.round((random() - 0.5) * 540)}deg`,
    testID: testIdPrefix ? `${testIdPrefix}${i}` : undefined,
  }));
}

export function Confetti({
  height = 360,
  colors,
  palette,
  count = COUNT,
  pieces,
  reducedMotion = false,
  seed,
  testIdPrefix,
}: ConfettiProps) {
  const resolvedPalette = palette ?? colors ?? BLOCK_THEMES[0].cellColors;

  const resolvedPieces = useMemo(
    () =>
      pieces ??
      buildConfettiPieces({
        count,
        height,
        palette: resolvedPalette,
        reducedMotion,
        seed,
        testIdPrefix,
      }),
    [count, height, pieces, reducedMotion, resolvedPalette, seed, testIdPrefix],
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
      {resolvedPieces.map((p) => {
        const kf = new Keyframe(
          reducedMotion
            ? {
                0: {
                  opacity: 0,
                  transform: [{ scale: 0.9 }],
                },
                35: {
                  opacity: 1,
                  transform: [{ scale: 1.04 }],
                },
                100: {
                  opacity: 0,
                  transform: [{ scale: 0.98 }],
                },
              }
            : {
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
              },
        )
          .duration(reducedMotion ? 220 : 1200)
          .delay(p.delay);

        return (
          <Animated.View
            key={p.id}
            entering={kf}
            testID={p.testID}
            style={{
              position: 'absolute',
              left: `${p.leftPct}%`,
              top: p.top,
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
