import { Fragment } from 'react';
import Animated, { Keyframe } from 'react-native-reanimated';

import type {
  PlacementParticlePresentation,
  PlacementPresentation,
} from '../animation/gameFeelPresentation';
import { GAME_FEEL_MOTION } from '../animation/motion';

interface PlacementParticleLayerProps {
  presentation: PlacementPresentation;
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

function flashAnimationFor(presentation: PlacementPresentation) {
  const scale = presentation.reducedMotion ? 1 : presentation.burstScale;
  return new Keyframe({
    0: {
      opacity: 0,
      transform: [{ scale: 0.86 }],
    },
    42: {
      opacity: presentation.flashAlpha,
      transform: [{ scale }],
    },
    100: {
      opacity: 0,
      transform: [{ scale: presentation.reducedMotion ? 1 : 1.04 }],
    },
  }).duration(GAME_FEEL_MOTION.placementFlashDurationMs);
}

function particleAnimationFor(
  particle: PlacementParticlePresentation,
  reducedMotion: boolean,
) {
  if (reducedMotion) {
    return new Keyframe({
      0: {
        opacity: 0,
        transform: [{ scale: 0.92 }],
      },
      48: {
        opacity: 0.9,
        transform: [{ scale: 1.04 }],
      },
      100: {
        opacity: 0,
        transform: [{ scale: 0.88 }],
      },
    })
      .duration(particle.durationMs)
      .delay(particle.delayMs);
  }

  return new Keyframe({
    0: {
      opacity: 0,
      transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 0.4 }],
    },
    22: {
      opacity: 1,
      transform: [
        { translateX: particle.dx * 0.16 },
        { translateY: particle.dy * 0.16 },
        { rotate: `${particle.rotateDeg * 0.18}deg` },
        { scale: 1 },
      ],
    },
    100: {
      opacity: 0,
      transform: [
        { translateX: particle.dx },
        { translateY: particle.dy },
        { rotate: `${particle.rotateDeg}deg` },
        { scale: 0.2 },
      ],
    },
  })
    .duration(particle.durationMs)
    .delay(particle.delayMs);
}

export function PlacementParticleLayer({
  presentation,
  color,
}: PlacementParticleLayerProps) {
  const flashSize = Math.max(18, presentation.scoreScale * 28);

  return (
    <Fragment>
      <Animated.View
        entering={flashAnimationFor(presentation)}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: presentation.anchor.x - flashSize / 2,
          top: presentation.anchor.y - flashSize / 2,
          width: flashSize,
          height: flashSize,
          borderRadius: 999,
          backgroundColor: alphaColor(color, Math.max(0.12, presentation.flashAlpha)),
        }}
      />
      {presentation.particles.map((particle) => (
        <Animated.View
          key={particle.id}
          entering={particleAnimationFor(particle, presentation.reducedMotion)}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: particle.x - particle.size / 2,
            top: particle.y - particle.size / 2,
            width: particle.size,
            height: particle.size,
            borderRadius: Math.max(1, particle.size / 2),
            backgroundColor: particle.color,
          }}
        />
      ))}
    </Fragment>
  );
}
