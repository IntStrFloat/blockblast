import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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
  color: string;
}

interface ParticleHandle {
  play: (particle: PlacementParticlePresentation, reducedMotion: boolean) => void;
}

function alphaColor(color: string, alpha: number) {
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) return `rgba(255,255,255,${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
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
    borderRadius: Math.max(1, size.value / 2),
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
  color,
}: PlacementParticleLayerProps) {
  const flashX = useSharedValue(0);
  const flashY = useSharedValue(0);
  const flashSize = useSharedValue(0);
  const flashColor = useSharedValue('rgba(255,255,255,0)');
  const flashScale = useSharedValue(0.86);
  const flashOpacity = useSharedValue(0);
  const slots = useRef<(ParticleHandle | null)[]>([]);

  useEffect(() => {
    const size = Math.max(18, presentation.scoreScale * 28);
    flashX.value = presentation.anchor.x - size / 2;
    flashY.value = presentation.anchor.y - size / 2;
    flashSize.value = size;
    flashColor.value = alphaColor(color, Math.max(0.12, presentation.flashAlpha));
    flashScale.value = 0.86;
    flashOpacity.value = 0;
    flashOpacity.value = withSequence(
      withTiming(presentation.flashAlpha, { duration: GAME_FEEL_MOTION.placementFlashDurationMs * 0.42 }),
      withTiming(0, { duration: GAME_FEEL_MOTION.placementFlashDurationMs * 0.58 }),
    );
    flashScale.value = withSequence(
      withTiming(presentation.reducedMotion ? 1 : presentation.burstScale, {
        duration: GAME_FEEL_MOTION.placementFlashDurationMs * 0.42,
      }),
      withTiming(presentation.reducedMotion ? 1 : 1.04, {
        duration: GAME_FEEL_MOTION.placementFlashDurationMs * 0.58,
      }),
    );

    presentation.particles.forEach((particle, index) => {
      slots.current[index % POOL_SIZE]?.play(particle, presentation.reducedMotion);
    });
  }, [color, flashColor, flashOpacity, flashScale, flashSize, flashX, flashY, presentation]);

  const flashStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: flashX.value,
    top: flashY.value,
    width: flashSize.value,
    height: flashSize.value,
    borderRadius: 999,
    backgroundColor: flashColor.value,
    opacity: flashOpacity.value,
    transform: [{ scale: flashScale.value }],
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={flashStyle} />
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
