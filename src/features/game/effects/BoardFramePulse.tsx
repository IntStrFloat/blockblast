import Animated, { Keyframe } from 'react-native-reanimated';

import { radii } from '@/ui';

import type { ComboFramePresentation } from '../animation/gameFeelPresentation';
import { GAME_FEEL_MOTION } from '../animation/motion';

interface BoardFramePulseProps {
  presentation: ComboFramePresentation;
  color: string;
}

function alphaColor(color: string, alpha: number) {
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) return `rgba(255,255,255,${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function animationFor(presentation: ComboFramePresentation) {
  if (presentation.reducedMotion) {
    return new Keyframe({
      0: {
        opacity: 0,
        transform: [{ scale: 1 }],
      },
      44: {
        opacity: 0.82,
        transform: [{ scale: 1 }],
      },
      100: {
        opacity: 0,
        transform: [{ scale: 1 }],
      },
    }).duration(GAME_FEEL_MOTION.comboFrameReducedDurationMs);
  }

  return new Keyframe({
    0: {
      opacity: 0,
      transform: [{ scale: 0.985 }],
    },
    24: {
      opacity: 0.94,
      transform: [{ scale: presentation.scale }],
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
    },
  }).duration(GAME_FEEL_MOTION.comboFramePulseDurationMs);
}

export function BoardFramePulse({ presentation, color }: BoardFramePulseProps) {
  if (presentation.intensity <= 0) return null;

  const borderAlpha = Math.min(
    0.18 + presentation.intensity * 0.24 + presentation.boardClearStrength * 0.16,
    0.58,
  );
  const fillAlpha = Math.min(
    0.04 + presentation.intensity * 0.08 + presentation.lineStrength * 0.05,
    0.18,
  );

  return (
    <Animated.View
      entering={animationFor(presentation)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        borderRadius: radii.card / 2,
        borderWidth: 2 + presentation.lineStrength + presentation.boardClearStrength,
        borderColor: alphaColor(color, borderAlpha),
        backgroundColor: alphaColor(color, fillAlpha),
      }}
    />
  );
}
