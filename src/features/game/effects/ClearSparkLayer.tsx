import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import type { ClearPresentationInstance, ClearSpark } from '../animation/clearPresentation';
import { BURST_MOTION } from '../animation/motion';

const POOL_SIZE = BURST_MOTION.sparkCap * 2;

interface SparkHandle {
  play: (spark: ClearSpark) => void;
}

/**
 * A single pooled particle. The trajectory is solved per-frame on the
 * Reanimated UI thread (v * t + 1/2 * g * t²); React only supplies the next
 * deterministic set of initial conditions for a clear.
 */
const SparkParticle = forwardRef<SparkHandle>(function SparkParticle(_props, ref) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const size = useSharedValue(0);
  const color = useSharedValue('#FFFFFF');
  const glowColor = useSharedValue('rgba(255,255,255,0)');
  const velocityX = useSharedValue(0);
  const velocityY = useSharedValue(0);
  const gravity = useSharedValue(0);
  const spin = useSharedValue(0);
  const diamond = useSharedValue(0);
  const duration = useSharedValue(0);
  const delayRemaining = useSharedValue(0);
  const elapsed = useSharedValue(0);
  const active = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useImperativeHandle(
    ref,
    () => ({
      play(spark) {
        x.value = spark.x;
        y.value = spark.y;
        size.value = spark.size;
        color.value = spark.color;
        glowColor.value = spark.glowColor;
        velocityX.value = spark.velocityX;
        velocityY.value = spark.velocityY;
        gravity.value = spark.gravity;
        spin.value = spark.spinDegPerSecond;
        diamond.value = spark.shape === 'diamond' ? 1 : 0;
        duration.value = spark.duration;
        delayRemaining.value = spark.delay;
        elapsed.value = 0;
        tx.value = 0;
        ty.value = 0;
        rotate.value = spark.shape === 'diamond' ? 45 : 0;
        scale.value = 0.32;
        opacity.value = 0;
        active.value = 1;
      },
    }),
    // Shared values remain stable for the lifetime of a pooled particle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrameCallback((frame) => {
    'worklet';
    if (active.value === 0) return;

    let deltaMs = Math.min(frame.timeSincePreviousFrame ?? 0, 34);
    if (deltaMs <= 0) return;

    if (delayRemaining.value > 0) {
      const remaining = delayRemaining.value - deltaMs;
      if (remaining > 0) {
        delayRemaining.value = remaining;
        return;
      }
      delayRemaining.value = 0;
      deltaMs = -remaining;
    }

    elapsed.value += deltaMs;
    if (elapsed.value >= duration.value) {
      opacity.value = 0;
      active.value = 0;
      return;
    }

    const progress = elapsed.value / duration.value;
    const seconds = elapsed.value / 1000;
    tx.value = velocityX.value * seconds;
    ty.value = velocityY.value * seconds + 0.5 * gravity.value * seconds * seconds;
    rotate.value = (diamond.value === 1 ? 45 : 0) + spin.value * seconds;
    opacity.value = progress < 0.14 ? progress / 0.14 : Math.max(0, (1 - progress) / 0.86);
    scale.value = progress < 0.16 ? 0.38 + progress * 4.1 : 1.04 - progress * 0.34;
  });

  const coreStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value - size.value / 2,
    top: y.value - size.value / 2,
    width: size.value,
    height: size.value,
    borderRadius: diamond.value === 1 ? Math.max(1, size.value * 0.16) : size.value / 2,
    backgroundColor: color.value,
    borderWidth: Math.max(0.6, size.value * 0.09),
    borderColor: 'rgba(255,255,255,0.88)',
    opacity: opacity.value,
    overflow: 'hidden',
    zIndex: 2,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value - size.value * 1.5,
    top: y.value - size.value * 1.5,
    width: size.value * 3,
    height: size.value * 3,
    borderRadius: size.value * 1.5,
    backgroundColor: glowColor.value,
    opacity: opacity.value * 0.68,
    zIndex: 1,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value * 1.2 },
    ],
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={haloStyle} />
      <Animated.View pointerEvents="none" style={coreStyle}>
        <View
          style={{
            position: 'absolute',
            top: '10%',
            left: '14%',
            width: '48%',
            height: '25%',
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.75)',
          }}
        />
      </Animated.View>
    </>
  );
});

interface ClearSparkLayerProps {
  presentations: readonly ClearPresentationInstance[];
}

export function ClearSparkLayer({ presentations }: ClearSparkLayerProps) {
  const slots = useRef<(SparkHandle | null)[]>([]);
  const cursor = useRef(0);
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeIds = new Set(presentations.map((presentation) => presentation.id));
    fired.current.forEach((id) => {
      if (!activeIds.has(id)) fired.current.delete(id);
    });

    for (const { id, presentation } of presentations) {
      if (fired.current.has(id)) continue;
      fired.current.add(id);
      for (const spark of presentation.sparks) {
        const slot = slots.current[cursor.current % POOL_SIZE];
        cursor.current += 1;
        slot?.play(spark);
      }
    }
  }, [presentations]);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
    >
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <SparkParticle
          key={index}
          ref={(handle) => {
            slots.current[index] = handle;
          }}
        />
      ))}
    </View>
  );
}
