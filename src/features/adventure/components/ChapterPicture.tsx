import { memo } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';

// Visible authored pixels are copied from the supplied level-complete HTML.
// The reference only exposes 4/12; unrevealed silhouette pixels continue the same fur palette.
const PIXELS: (string | null)[][] = [
  [null, '#E8B678', '#E8B678', null, null, null, null, '#E8B678', '#E8B678', null],
  [
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
  ],
  [
    null,
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    null,
  ],
  [
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
  ],
  [
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
  ],
  [
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#F4A6A6',
    '#F4A6A6',
    '#FFD59A',
  ],
  [
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#2A1A2E',
    '#2A1A2E',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
  ],
  [
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
    '#2A1A2E',
    '#FFD59A',
    '#FFD59A',
    '#2A1A2E',
    '#FFD59A',
    '#FFD59A',
    '#FFD59A',
  ],
  [
    null,
    '#FFD59A',
    '#FFD59A',
    '#E8B678',
    '#2A1A2E',
    '#2A1A2E',
    '#E8B678',
    '#FFD59A',
    '#FFD59A',
    null,
  ],
  [null, null, '#E8B678', '#E8B678', '#E8B678', '#E8B678', '#E8B678', '#E8B678', null, null],
];
const FILL_COUNTS = [0, 12, 24, 34, 38, 44, 50, 56, 62, 68, 74, 80, 86];
const ORDER = PIXELS.flatMap((row, r) => row.flatMap((color, c) => (color ? [{ r, c }] : []))).sort(
  (a, b) => b.r - a.r || b.c - a.c,
);

export const ChapterPicture = memo(function ChapterPicture({
  parts,
  width = 227,
  reveal = false,
}: {
  parts: number;
  width?: number;
  reveal?: boolean;
}) {
  const reduced = useReducedMotion();
  const count = Math.min(12, Math.max(0, Math.floor(parts)));
  const filled = FILL_COUNTS[count];
  const previous = FILL_COUNTS[Math.max(0, count - 1)];
  const gap = (width * 3) / 227;
  const cell = (width - gap * 9) / 10;
  return (
    <View
      accessible
      accessibilityLabel={`Картина: ${count} из 12 частей`}
      style={{ width, height: width }}
    >
      {ORDER.map(({ r, c }, index) => {
        const color = index < filled ? PIXELS[r][c]! : '#232C88';
        const latest = reveal && index >= previous && index < filled;
        return (
          <Animated.View
            key={`${r}:${c}`}
            entering={
              latest && !reduced ? FadeIn.duration(420).delay((index - previous) * 45) : undefined
            }
            style={{
              position: 'absolute',
              left: c * (cell + gap),
              top: r * (cell + gap),
              width: cell,
              height: cell,
              borderRadius: cell * 0.2,
              backgroundColor: color,
              borderTopWidth: index >= filled ? 2 : 0,
              borderTopColor: 'rgba(0,0,0,0.2)',
              boxShadow: latest
                ? '0px 0px 0px 2px #FFC93C, 0px 0px 10px rgba(255,201,60,0.9)'
                : 'none',
            }}
          />
        );
      })}
    </View>
  );
});
