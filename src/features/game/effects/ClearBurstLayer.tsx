import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type {
  ClearBurstShard,
  ClearPresentationInstance,
} from '../animation/clearPresentation';
import { ADVENTURE_SHATTER_MOTION, BURST_MOTION } from '../animation/motion';

const POOL_SIZE = BURST_MOTION.shardPoolSize;

interface BurstHandle {
  stop: () => void;
  play: (shard: ClearBurstShard, reducedMotion: boolean) => void;
}

interface ClearBurstLayerProps {
  presentations: readonly ClearPresentationInstance[];
}

/**
 * A shard slot is mounted once for the whole game. Updating its shared values
 * in a layout effect makes the frame-zero cell replacement available before
 * paint, without mounting dozens of transient views in the accepted-drop commit.
 */
const BurstParticle = forwardRef<BurstHandle>(function BurstParticle(_props, ref) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const color = useSharedValue('#FFFFFF');
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotation = useSharedValue(0);

  const stop = useCallback(() => {
    cancelAnimation(color);
    cancelAnimation(scale);
    cancelAnimation(opacity);
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(rotation);
    opacity.value = 0;
    // Pool shared values are stable for the slot lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => stop, [stop]);

  useImperativeHandle(
    ref,
    () => ({
      stop,
      play(shard, reducedMotion) {
        x.value = shard.x;
        y.value = shard.y;
        width.value = shard.width;
        height.value = shard.height;
        color.value = shard.color;
        scale.value = 1;
        tx.value = 0;
        ty.value = 0;
        rotation.value = 0;
        // The logical board is already clear. Coverage must exist immediately;
        // delay belongs to the crack, never to shard visibility.
        opacity.value = 1;

        if (reducedMotion) {
          opacity.value = withTiming(0, { duration: BURST_MOTION.reducedFadeMs });
          return;
        }

        if (shard.flashColor !== shard.color) {
          color.value = withDelay(
            shard.delay,
            withSequence(
              withTiming(shard.flashColor, { duration: BURST_MOTION.crackFlashInMs }),
              withTiming(shard.color, { duration: BURST_MOTION.crackFlashOutMs }),
            ),
          );
        }
        if (shard.flight) {
          const { dx, dy, liftY, rotationDeg } = shard.flight;
          const liftMs = ADVENTURE_SHATTER_MOTION.liftDurationMs;
          tx.value = withDelay(shard.delay, withTiming(dx, { duration: shard.duration, easing: Easing.out(Easing.quad) }));
          ty.value = withDelay(shard.delay, withSequence(
            withTiming(liftY, { duration: liftMs, easing: Easing.out(Easing.quad) }),
            withTiming(dy, { duration: shard.duration - liftMs, easing: Easing.in(Easing.quad) }),
          ));
          rotation.value = withDelay(shard.delay, withTiming(rotationDeg, { duration: shard.duration }));
          scale.value = withDelay(shard.delay, withSequence(
            withTiming(ADVENTURE_SHATTER_MOTION.popScale, { duration: 40 }),
            withTiming(ADVENTURE_SHATTER_MOTION.finalScale, { duration: shard.duration - 40 }),
          ));
          opacity.value = withDelay(
            shard.delay + shard.duration - ADVENTURE_SHATTER_MOTION.fadeDurationMs,
            withTiming(0, { duration: ADVENTURE_SHATTER_MOTION.fadeDurationMs }),
          );
          return;
        }
        scale.value = withDelay(
          shard.delay,
          withTiming(BURST_MOTION.dissolveScale, {
            duration: shard.duration,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
        );
        opacity.value = withDelay(
          shard.delay,
          withTiming(0, { duration: shard.duration }),
        );
      },
    }),
    // Shared values are stable for the lifetime of the pre-mounted slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    borderRadius: Math.max(1.5, Math.min(width.value, height.value) * 0.16),
    borderWidth: Math.max(0.5, Math.min(width.value, height.value) * 0.045),
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: color.value,
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return <Animated.View pointerEvents="none" style={style} />;
});

export function ClearBurstLayer({ presentations }: ClearBurstLayerProps) {
  const slots = useRef<(BurstHandle | null)[]>([]);
  const owners = useRef<(string | null)[]>([]);
  const cursor = useRef(0);
  const fired = useRef<Set<string>>(new Set());

  useLayoutEffect(() => {
    const activeIds = new Set(presentations.map(({ id }) => id));
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
      for (const shard of presentation.shards) {
        const index = cursor.current % POOL_SIZE;
        const slot = slots.current[index];
        cursor.current += 1;
        slot?.stop();
        owners.current[index] = id;
        slot?.play(shard, presentation.reducedMotion);
      }
    }
  }, [presentations]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
    >
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <BurstParticle
          key={index}
          ref={(handle) => {
            slots.current[index] = handle;
          }}
        />
      ))}
    </View>
  );
}
