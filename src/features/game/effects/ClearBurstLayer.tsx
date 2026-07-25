/**
 * ClearBurstLayer — пул переиспользуемых вью для анимации разрушения линий.
 *
 * Спека 07, правило #5: частицы — фиксированный пул переиспользуемых вью без
 * mount/unmount в горячем пути. Пул из POOL_SIZE вью монтируется один раз и
 * живёт всё время игры; на каждый клир мы лишь перезапускаем shared values
 * свободных слотов (анимация целиком на UI-потоке). Это убирает «рывок» от
 * массового монтирования Animated.View на каждый фрагмент, как в старых
 * покадровых слоях.
 *
 * Один слот = один осколок расколотой ячейки: куски тайлят ячейку в кадре
 * клира (бесшовная подмена блока), затем вспышка-крак, подскок с разлётом
 * и тяжёлое падение за нижний край доски.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { ClearBurstShard, ClearPresentationInstance } from '../animation/clearPresentation';
import { BURST_MOTION } from '../animation/motion';

/** Два перекрывающихся клира по shardBudget осколков. */
const POOL_SIZE = BURST_MOTION.shardBudget * 2;

interface BurstHandle {
  play: (shard: ClearBurstShard) => void;
}

/** Одна переиспользуемая частица: все свойства — shared values, ноль re-render. */
const BurstParticle = forwardRef<BurstHandle>(function BurstParticle(_props, ref) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const color = useSharedValue('#FFFFFF');
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useImperativeHandle(
    ref,
    () => ({
      play(shard: ClearBurstShard) {
        // Стартовая поза = кусок самой ячейки (те же размер/цвет), поэтому
        // осколки визуально подменяют мгновенно очищенную доску без разрыва.
        x.value = shard.x;
        y.value = shard.y;
        width.value = shard.width;
        height.value = shard.height;
        color.value = shard.color;
        tx.value = 0;
        ty.value = 0;
        rotate.value = 0;
        scale.value = 1;
        // Видимость — мгновенная: доска пустеет в этом же кадре, любой фейд-ин
        // или задержка появления дают «разрез». Задержка ячейки распределяет
        // только раскол, разлёт и затухание.
        opacity.value = 1;

        const jumpMs = BURST_MOTION.jumpDurationMs;
        const fallMs = shard.fallDuration;

        // Вспышка-крак в момент раскола: цвет вспыхивает светлым и гаснет.
        if (shard.flashColor !== shard.color) {
          color.value = withDelay(
            shard.delay,
            withSequence(
              withTiming(shard.flashColor, { duration: BURST_MOTION.crackFlashInMs }),
              withTiming(shard.color, { duration: BURST_MOTION.crackFlashOutMs }),
            ),
          );
        }

        // Подскок от удара (ease-out) → тяжёлое ускоряющееся падение за
        // нижний край доски (ease-in). Вращение добирает амплитуду весь полёт.
        ty.value = withDelay(
          shard.delay,
          withSequence(
            withTiming(shard.jumpY, { duration: jumpMs, easing: Easing.out(Easing.quad) }),
            withTiming(shard.dy, { duration: fallMs, easing: Easing.in(Easing.quad) }),
          ),
        );
        tx.value = withDelay(
          shard.delay,
          withSequence(
            withTiming(shard.driftX, { duration: jumpMs, easing: Easing.out(Easing.quad) }),
            withTiming(shard.dx, { duration: fallMs, easing: Easing.out(Easing.quad) }),
          ),
        );
        rotate.value = withDelay(
          shard.delay,
          withTiming(shard.rotate, { duration: jumpMs + fallMs, easing: Easing.out(Easing.quad) }),
        );
        scale.value = withDelay(
          shard.delay,
          withSequence(
            withTiming(BURST_MOTION.popScale, {
              duration: BURST_MOTION.popDurationMs,
              easing: Easing.out(Easing.quad),
            }),
            withTiming(BURST_MOTION.fallScale, {
              duration: jumpMs + fallMs - BURST_MOTION.popDurationMs,
            }),
          ),
        );
        // Затухание — только у нижней границы, чтобы осколки не ложились на трей.
        opacity.value = withDelay(
          shard.delay + jumpMs + fallMs - BURST_MOTION.fadeDurationMs,
          withTiming(0, { duration: BURST_MOTION.fadeDurationMs, easing: Easing.in(Easing.quad) }),
        );
      },
    }),
    // shared values стабильны на весь жизненный цикл — пустой deps корректен.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    // Сколотые края: радиус заметно меньше, чем у целого блока.
    borderRadius: Math.max(1.5, Math.min(width.value, height.value) * 0.16),
    backgroundColor: color.value,
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={style}>
      {/* Reuse the block's bevel language, so a broken tile still reads as a
          fragment of the tile rather than a flat coloured rectangle. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '24%',
          backgroundColor: 'rgba(255,255,255,0.30)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '18%',
          backgroundColor: 'rgba(6,15,44,0.28)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: '24%',
          left: '12%',
          width: '48%',
          height: '18%',
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}
      />
    </Animated.View>
  );
});

interface ClearBurstLayerProps {
  presentations: readonly ClearPresentationInstance[];
}

export function ClearBurstLayer({ presentations }: ClearBurstLayerProps) {
  const slots = useRef<(BurstHandle | null)[]>([]);
  const cursor = useRef(0);
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeIds = new Set(presentations.map((p) => p.id));
    // Освобождаем id, которых больше нет в очереди, чтобы тот же инстанс мог
    // сыграть ещё раз (повторный клир той же формы).
    fired.current.forEach((id) => {
      if (!activeIds.has(id)) fired.current.delete(id);
    });

    for (const { id, presentation } of presentations) {
      if (fired.current.has(id)) continue;
      fired.current.add(id);
      for (const shard of presentation.shards) {
        const slot = slots.current[cursor.current % POOL_SIZE];
        cursor.current += 1;
        slot?.play(shard);
      }
    }
  }, [presentations]);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
    >
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <BurstParticle
          key={i}
          ref={(handle) => {
            slots.current[i] = handle;
          }}
        />
      ))}
    </View>
  );
}
