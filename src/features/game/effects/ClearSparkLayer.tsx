import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { AppState, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { ClearPresentationInstance, ClearSpark } from '../animation/clearPresentation';
import { BURST_MOTION } from '../animation/motion';

const POOL_SIZE = BURST_MOTION.sparkCap * 2;

interface SparkHandle {
  stop: () => void;
  play: (spark: ClearSpark) => void;
}

interface FrameController {
  setActive: (active: boolean) => void;
  isActive: boolean;
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
  const velocityX = useSharedValue(0);
  const velocityY = useSharedValue(0);
  const gravity = useSharedValue(0);
  const spin = useSharedValue(0);
  const duration = useSharedValue(0);
  const delayRemaining = useSharedValue(0);
  const elapsed = useSharedValue(0);
  const active = useSharedValue(0);
  const generation = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const frameControllerRef = useRef<FrameController | null>(null);

  const stop = useCallback(() => {
    generation.value += 1;
    frameControllerRef.current?.setActive(false);
    active.value = 0;
    delayRemaining.value = 0;
    elapsed.value = 0;
    opacity.value = 0;
    // Pool shared values are stable for the slot lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stopIfCurrent = useCallback((completedGeneration: number) => {
    if (generation.value !== completedGeneration || active.value !== 0) return;
    frameControllerRef.current?.setActive(false);
    // Shared values remain stable for the slot lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const frameController = useFrameCallback(useCallback((frame) => {
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
      scheduleOnRN(stopIfCurrent, generation.value);
      return;
    }

    const progress = elapsed.value / duration.value;
    const seconds = elapsed.value / 1000;
    tx.value = velocityX.value * seconds;
    ty.value = velocityY.value * seconds + 0.5 * gravity.value * seconds * seconds;
    rotate.value = spin.value * seconds;
    opacity.value = progress < 0.14 ? progress / 0.14 : Math.max(0, (1 - progress) / 0.86);
    scale.value = progress < 0.16 ? 0.38 + progress * 4.1 : 1.04 - progress * 0.34;
  // Shared values remain stable for the slot lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopIfCurrent]), false);

  useLayoutEffect(() => {
    frameControllerRef.current = frameController;
    return () => {
      frameController.setActive(false);
      frameControllerRef.current = null;
      stop();
    };
  }, [frameController, stop]);

  useImperativeHandle(
    ref,
    () => ({
      stop,
      play(spark) {
        generation.value += 1;
        x.value = spark.x;
        y.value = spark.y;
        size.value = spark.size;
        color.value = spark.color;
        velocityX.value = spark.velocityX;
        velocityY.value = spark.velocityY;
        gravity.value = spark.gravity;
        spin.value = spark.spinDegPerSecond;
        duration.value = spark.duration;
        delayRemaining.value = spark.delay;
        elapsed.value = 0;
        tx.value = 0;
        ty.value = 0;
        rotate.value = 0;
        scale.value = 0.32;
        opacity.value = 0;
        active.value = 1;
        frameControllerRef.current?.setActive(true);
      },
    }),
    // Shared values remain stable for the lifetime of a pooled particle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stop],
  );

  const geometryStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value - size.value / 2,
    top: y.value - size.value / 2,
    width: size.value,
    height: size.value,
    borderRadius: Math.max(0.5, size.value * 0.1),
    backgroundColor: color.value,
    borderWidth: Math.max(0.6, size.value * 0.09),
    borderColor: 'rgba(255,255,255,0.88)',
    overflow: 'hidden',
    zIndex: 2,
  }));
  const motionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return <Animated.View pointerEvents="none" style={[geometryStyle, motionStyle]} />;

});

interface ClearSparkLayerProps {
  presentations: readonly ClearPresentationInstance[];
}

export function ClearSparkLayer({ presentations }: ClearSparkLayerProps) {
  const slots = useRef<(SparkHandle | null)[]>([]);
  const owners = useRef<(string | null)[]>([]);
  const cursor = useRef(0);
  const fired = useRef<Set<string>>(new Set());
  const particles = useMemo(() => Array.from({ length: POOL_SIZE }, (_, index) => (
    <SparkParticle key={index} ref={(handle) => { slots.current[index] = handle; }} />
  )), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      slots.current.forEach((slot, index) => {
        slot?.stop();
        owners.current[index] = null;
      });
    });
    return () => subscription.remove();
  }, []);

  useLayoutEffect(() => {
    const activeIds = new Set(presentations.map((presentation) => presentation.id));
    owners.current.forEach((owner, index) => {
      if (owner && !activeIds.has(owner)) {
        slots.current[index]?.stop();
        owners.current[index] = null;
      }
    });
    fired.current.forEach((id) => {
      if (!activeIds.has(id)) fired.current.delete(id);
    });

    for (const { id, presentation } of presentations) {
      if (fired.current.has(id)) continue;
      fired.current.add(id);
      for (const spark of presentation.sparks) {
        const index = cursor.current % POOL_SIZE;
        const slot = slots.current[index];
        cursor.current += 1;
        slot?.stop();
        owners.current[index] = id;
        slot?.play(spark);
      }
    }
  }, [presentations]);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
    >
      {particles}
    </View>
  );
}
