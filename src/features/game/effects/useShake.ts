import { useCallback } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { ShakePresentation } from '../animation/clearPresentation';
import type { ComboFramePresentation } from '../animation/gameFeelPresentation';
import { SPECTACLE_MOTION } from '../animation/motion';

interface ShakeSources {
  clear: ShakePresentation | null;
  combo: ComboFramePresentation | null;
}

const NEUTRAL_SHAKE: ShakePresentation = {
  amplitude: 0,
  scale: 1,
  durationMs: 0,
};

export function composeShakePresentation(
  clear: ShakePresentation | null,
  combo: ComboFramePresentation | null,
): ShakePresentation {
  const amplitude = Math.max(clear?.amplitude ?? 0, combo?.shakeAmplitude ?? 0);
  const durationMs = Math.max(clear?.durationMs ?? 0, combo?.shakeDurationMs ?? 0);

  if (amplitude <= 0 || durationMs <= 0) return NEUTRAL_SHAKE;

  return {
    amplitude,
    scale: Math.max(clear?.scale ?? 1, combo?.scale ?? 1, 1),
    durationMs,
  };
}

export function useShake() {
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const shakeScale = useSharedValue(1);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { translateY: shakeY.value },
      { scale: shakeScale.value },
    ],
  }));

  const triggerShake = useCallback(
    (sources: ShakeSources) => {
      cancelAnimation(shakeX);
      cancelAnimation(shakeY);
      cancelAnimation(shakeScale);

      const presentation = composeShakePresentation(sources.clear, sources.combo);
      if (presentation.amplitude <= 0) {
        shakeX.value = withTiming(0, { duration: 40 });
        shakeY.value = withTiming(0, { duration: 40 });
        shakeScale.value = withTiming(1, { duration: 40 });
        return;
      }

      const beat = Math.max(18, Math.round(presentation.durationMs / 6));
      shakeX.value = withDelay(
        SPECTACLE_MOTION.debrisStartMs,
        withSequence(
          withTiming(-presentation.amplitude, { duration: beat }),
          withTiming(presentation.amplitude, { duration: beat }),
          withTiming(-presentation.amplitude * 0.72, { duration: beat }),
          withTiming(presentation.amplitude * 0.52, { duration: beat }),
          withTiming(-presentation.amplitude * 0.28, { duration: beat }),
          withTiming(0, { duration: beat }),
        ),
      );
      shakeY.value = withDelay(
        SPECTACLE_MOTION.debrisStartMs,
        withSequence(
          withTiming(presentation.amplitude * 0.32, { duration: beat * 2 }),
          withTiming(-presentation.amplitude * 0.24, { duration: beat * 2 }),
          withTiming(0, { duration: beat * 2 }),
        ),
      );
      shakeScale.value = withDelay(
        SPECTACLE_MOTION.debrisStartMs,
        withSequence(
          withTiming(presentation.scale, { duration: beat * 2 }),
          withTiming(1, { duration: beat * 4 }),
        ),
      );
    },
    [shakeScale, shakeX, shakeY],
  );

  return { shakeStyle, triggerShake };
}
