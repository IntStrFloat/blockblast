import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type {
  PlacementParticlePresentation,
  PlacementPresentation,
} from '../animation/gameFeelPresentation';
import { GAME_FEEL_MOTION } from '../animation/motion';

const POOL_SIZE = GAME_FEEL_MOTION.placementParticleMax;

interface PlacementParticleLayerProps {
  presentation: PlacementPresentation;
}

interface ParticleHandle {
  play: (particle: PlacementParticlePresentation, reducedMotion: boolean) => void;
}

const PlacementParticle = forwardRef<ParticleHandle>(function PlacementParticle(_props, ref) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const size = useSharedValue(0);
  const color = useSharedValue('#FFFFFF');
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useImperativeHandle(
    ref,
    () => ({
      play(particle, reducedMotion) {
        x.value = particle.x - particle.size / 2;
        y.value = particle.y - particle.size / 2;
        size.value = particle.size;
        color.value = particle.color;
        tx.value = 0;
        ty.value = 0;
        rotate.value = 0;
        scale.value = reducedMotion ? 0.92 : 0.4;
        opacity.value = 0;

        opacity.value = withDelay(
          particle.delayMs,
          withSequence(
            withTiming(reducedMotion ? 0.9 : 1, { duration: Math.max(40, particle.durationMs * 0.22) }),
            withTiming(0, { duration: Math.max(120, particle.durationMs * 0.78) }),
          ),
        );
        tx.value = withDelay(particle.delayMs, withTiming(particle.dx, { duration: particle.durationMs, easing: Easing.out(Easing.quad) }));
        ty.value = withDelay(particle.delayMs, withTiming(particle.dy, { duration: particle.durationMs, easing: Easing.out(Easing.quad) }));
        rotate.value = withDelay(
          particle.delayMs,
          withTiming(reducedMotion ? 0 : particle.rotateDeg, { duration: particle.durationMs }),
        );
        scale.value = withDelay(
          particle.delayMs,
          withSequence(
            withTiming(reducedMotion ? 1.04 : 1, { duration: Math.max(40, particle.durationMs * 0.22) }),
            withTiming(reducedMotion ? 0.88 : 0.2, { duration: Math.max(120, particle.durationMs * 0.78) }),
          ),
        );
      },
    }),
    // shared values are stable for the particle lifetime; ref API must stay stable too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    width: size.value,
    height: size.value,
    borderRadius: Math.max(1, size.value * 0.16),
    backgroundColor: color.value,
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return <Animated.View pointerEvents="none" style={style} />;
});

export function PlacementParticleLayer({
  presentation,
}: PlacementParticleLayerProps) {
  const slots = useRef<(ParticleHandle | null)[]>([]);

  useLayoutEffect(() => {
    presentation.particles.forEach((particle, index) => {
      slots.current[index % POOL_SIZE]?.play(particle, presentation.reducedMotion);
    });
  }, [presentation]);

  return (
    <>
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <PlacementParticle
          key={index}
          ref={(handle) => {
            slots.current[index] = handle;
          }}
        />
      ))}
    </>
  );
}
