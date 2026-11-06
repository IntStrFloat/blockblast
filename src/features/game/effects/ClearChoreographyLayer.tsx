import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
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

import type { EffectMote } from '../animation/effectSequence';
import {
  MAX_ACTIVE_CLEAR_PRESENTATIONS,
  type ClearPresentationInstance,
} from '../animation/clearPresentation';

interface ClearChoreographyLayerProps {
  presentations: readonly ClearPresentationInstance[];
}

const POOL_SIZE = {
  motes: MAX_ACTIVE_CLEAR_PRESENTATIONS * 8,
} as const;

interface MoteHandle {
  stop: () => void;
  play: (mote: EffectMote, reducedMotion: boolean) => void;
}

const MoteSlot = forwardRef<MoteHandle>(function MoteSlot(_props, ref) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const size = useSharedValue(0);
  const color = useSharedValue('#FFFFFF');
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);

  const stop = useCallback(() => {
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(opacity);
    opacity.value = 0;
    // Pool shared values are stable for the slot lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => stop, [stop]);

  useImperativeHandle(ref, () => ({
    stop,
    play(mote, reducedMotion) {
      opacity.value = 0;
      if (reducedMotion) return;
      x.value = mote.x - mote.size / 2;
      y.value = mote.y - mote.size / 2;
      size.value = mote.size;
      color.value = mote.color;
      tx.value = 0;
      ty.value = 0;
      const movement = {
        duration: mote.durationMs,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
      };
      opacity.value = withDelay(mote.delayMs, withSequence(
        withTiming(0.9, { duration: 25 }),
        withTiming(0, { duration: Math.max(1, mote.durationMs - 25) }),
      ));
      tx.value = withDelay(mote.delayMs, withTiming(mote.dx, movement));
      ty.value = withDelay(mote.delayMs, withTiming(mote.dy, movement));
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const geometryStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    width: size.value,
    height: size.value,
    backgroundColor: color.value,
  }));
  const motionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return <Animated.View pointerEvents="none" style={[geometryStyle, motionStyle]} />;
});

export function ClearChoreographyLayer({ presentations }: ClearChoreographyLayerProps) {
  const moteSlots = useRef<(MoteHandle | null)[]>([]);
  const moteOwners = useRef<(string | null)[]>([]);
  const moteCursor = useRef(0);
  const fired = useRef<Set<string>>(new Set());
  const particles = useMemo(() => (
    <>
      {Array.from({ length: POOL_SIZE.motes }, (_, index) => (
        <MoteSlot key={`mote-${index}`} ref={(handle) => { moteSlots.current[index] = handle; }} />
      ))}
    </>
  ), []);

  useLayoutEffect(() => {
    const activeIds = new Set(presentations.map(({ id }) => id));
    moteOwners.current.forEach((owner, index) => {
      if (owner && !activeIds.has(owner)) {
        moteSlots.current[index]?.stop();
        moteOwners.current[index] = null;
      }
    });
    fired.current.forEach((id) => {
      if (!activeIds.has(id)) fired.current.delete(id);
    });
    for (const { id, presentation } of presentations) {
      if (fired.current.has(id)) continue;
      fired.current.add(id);
      for (const mote of presentation.sequence.motes) {
        const index = moteCursor.current % POOL_SIZE.motes;
        const slot = moteSlots.current[index];
        moteCursor.current += 1;
        slot?.stop();
        moteOwners.current[index] = id;
        slot?.play(mote, presentation.reducedMotion);
      }
    }
  }, [presentations]);

  return (
    <View
      testID="clear-choreography-layer"
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'visible' }}
    >
      {particles}
    </View>
  );
}
