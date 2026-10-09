/**
 * ClearDebrisLayer — крошка-акцент разрушения: мелкие кусочки, вылетающие
 * той же волной, что и осколки ClearBurstLayer.
 *
 * Спека 07, правило #5: фиксированный пул переиспользуемых вью монтируется
 * один раз (сиблинг доски в BoardView) и живёт всё время игры — раньше слой
 * монтировался на каждый клир внутри GameEffectsLayer и давал mount-рывок.
 */
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

import type { ClearDebris, ClearPresentationInstance } from '../animation/clearPresentation';
import { BURST_MOTION } from '../animation/motion';

/** Два перекрывающихся клира по debrisCap крошек. */
const POOL_SIZE = BURST_MOTION.debrisCap * 2;

interface DebrisHandle {
  stop: () => void;
  play: (debris: ClearDebris) => void;
}

const DebrisParticle = forwardRef<DebrisHandle>(function DebrisParticle(_props, ref) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const size = useSharedValue(0);
  const color = useSharedValue('#FFFFFF');
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const stop = useCallback(() => {
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(rotate);
    cancelAnimation(scale);
    cancelAnimation(opacity);
    opacity.value = 0;
    // Pool shared values are stable for the slot lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => stop, [stop]);

  useImperativeHandle(
    ref,
    () => ({
      stop,
      play(item) {
        x.value = item.x - item.size / 2;
        y.value = item.y - item.size / 2;
        size.value = item.size;
        color.value = item.color;
        tx.value = 0;
        ty.value = 0;
        rotate.value = 0;
        scale.value = 0.65;
        opacity.value = 0;

        opacity.value = withDelay(
          item.delay,
          withSequence(
            withTiming(1, { duration: item.duration * 0.16 }),
            withTiming(0, { duration: item.duration * 0.84 }),
          ),
        );
        tx.value = withDelay(item.delay, withTiming(item.dx, { duration: item.duration, easing: Easing.out(Easing.quad) }));
        ty.value = withDelay(item.delay, withTiming(item.dy, { duration: item.duration, easing: Easing.out(Easing.quad) }));
        rotate.value = withDelay(item.delay, withTiming(item.rotateDeg, { duration: item.duration, easing: Easing.out(Easing.quad) }));
        scale.value = withDelay(
          item.delay,
          withSequence(
            withTiming(1, { duration: item.duration * 0.16 }),
            withTiming(0.24, { duration: item.duration * 0.84 }),
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
    borderRadius: Math.max(1, size.value * 0.18),
    borderWidth: Math.max(0.5, size.value * 0.08),
    borderColor: 'rgba(255,255,255,0.72)',
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

interface ClearDebrisLayerProps {
  presentations: readonly ClearPresentationInstance[];
}

export function ClearDebrisLayer({ presentations }: ClearDebrisLayerProps) {
  const slots = useRef<(DebrisHandle | null)[]>([]);
  const owners = useRef<(string | null)[]>([]);
  const cursor = useRef(0);
  const fired = useRef<Set<string>>(new Set());

  useLayoutEffect(() => {
    const activeIds = new Set(presentations.map((p) => p.id));
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
      for (const item of presentation.debris) {
        const index = cursor.current % POOL_SIZE;
        const slot = slots.current[index];
        cursor.current += 1;
        slot?.stop();
        owners.current[index] = id;
        slot?.play(item);
      }
    }
  }, [presentations]);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
    >
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <DebrisParticle
          key={index}
          ref={(handle) => {
            slots.current[index] = handle;
          }}
        />
      ))}
    </View>
  );
}
