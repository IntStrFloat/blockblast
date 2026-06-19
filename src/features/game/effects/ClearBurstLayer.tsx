/**
 * ClearBurstLayer — пул переиспользуемых вью для анимации разрушения линий.
 *
 * Спека 07, правило #5: частицы — фиксированный пул переиспользуемых вью без
 * mount/unmount в горячем пути. Пул из POOL_SIZE вью монтируется один раз и
 * живёт всё время игры; на каждый клир мы лишь перезапускаем shared values
 * свободных слотов (анимация целиком на UI-потоке). Это убирает «рывок» от
 * массового монтирования Animated.View, который был у старого подхода с
 * `entering={Keyframe}` на каждый фрагмент.
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

import type { ClearBurstCell, ClearPresentationInstance } from '../animation/clearPresentation';

/** Двух перекрывающихся клиров по 12 ячеек хватает на самый бурный ход. */
const POOL_SIZE = 24;

interface BurstHandle {
  play: (cell: ClearBurstCell) => void;
}

/** Одна переиспользуемая частица: все свойства — shared values, ноль re-render. */
const BurstParticle = forwardRef<BurstHandle>(function BurstParticle(_props, ref) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const size = useSharedValue(0);
  const color = useSharedValue('#FFFFFF');
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useImperativeHandle(
    ref,
    () => ({
      play(cell: ClearBurstCell) {
        // Стартовая поза = сама ячейка (тот же размер/цвет), поэтому «осколок»
        // визуально подменяет мгновенно очищенную доску без разрыва.
        x.value = cell.x;
        y.value = cell.y;
        size.value = cell.size;
        color.value = cell.color;
        tx.value = 0;
        ty.value = 0;
        rotate.value = 0;
        scale.value = 1;
        opacity.value = 0;

        opacity.value = withDelay(
          cell.delay,
          withSequence(
            withTiming(1, { duration: 60 }),
            withDelay(90, withTiming(0, { duration: 210, easing: Easing.in(Easing.quad) })),
          ),
        );
        scale.value = withDelay(
          cell.delay,
          withSequence(
            withTiming(1.12, { duration: 90, easing: Easing.out(Easing.quad) }),
            withTiming(0.18, { duration: 240, easing: Easing.in(Easing.cubic) }),
          ),
        );
        tx.value = withDelay(cell.delay, withTiming(cell.dx, { duration: 330, easing: Easing.out(Easing.quad) }));
        ty.value = withDelay(cell.delay, withTiming(cell.dy, { duration: 330, easing: Easing.out(Easing.quad) }));
        rotate.value = withDelay(cell.delay, withTiming(cell.rotate, { duration: 330, easing: Easing.out(Easing.quad) }));
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
    width: size.value,
    height: size.value,
    borderRadius: Math.max(2, size.value * 0.22),
    backgroundColor: color.value,
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return <Animated.View pointerEvents="none" style={style} />;
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
      for (const cell of presentation.cells) {
        const slot = slots.current[cursor.current % POOL_SIZE];
        cursor.current += 1;
        slot?.play(cell);
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
