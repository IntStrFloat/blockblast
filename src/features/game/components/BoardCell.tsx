import { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '@/ui';
import { shouldPulseOnFill } from '../animation/motion';
import { useDragCtx } from '../drag/DragContext';
import { Block } from './Block';

interface BoardCellProps {
  index: number;
  colorId: number;
  size: number;
  gap: number;
  fillColor: string; // cellColors[colorId-1], пустая строка если colorId=0
  emptyColor: string;
  reducedMotion: boolean;
}

export const BoardCell = memo(function BoardCell({
  index,
  colorId,
  size,
  gap,
  fillColor,
  emptyColor,
  reducedMotion,
}: BoardCellProps) {
  const ctx = useDragCtx();
  const r = (index / 8) | 0;
  const c = index % 8;
  const step = size + gap;
  const radius = ctx.cellRadius ?? (ctx.cellLine ? 2 : radii.cell);

  // Анимация размещения: scale 1.15→1.0 за 120мс (спека 04).
  // Триггер — переход пусто → блок. Маунт уже заполненной ячейки (резюм
  // сохранённой партии) не пульсирует — иначе вся доска «выстреливает» разом.
  const placedScale = useSharedValue(1);
  const prevColorIdRef = useRef(colorId);
  useEffect(() => {
    const prevColorId = prevColorIdRef.current;
    prevColorIdRef.current = colorId;
    if (shouldPulseOnFill(prevColorId, colorId)) {
      if (reducedMotion) {
        placedScale.value = 1;
        return;
      }
      placedScale.value = 1.15;
      placedScale.value = withTiming(1.0, { duration: 120 });
    }
  }, [colorId, placedScale, reducedMotion]);

  // Стиль базовой ячейки с анимацией размещения
  const cellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: placedScale.value }],
  }));

  // Превью drag — читаем shared values напрямую (ноль ре-рендеров)
  const cellColors = ctx.cellColors;
  const previewShared = ctx.preview;
  const previewColorShared = ctx.previewColor;

  const previewStyle = useAnimatedStyle(() => {
    const mask = previewShared.value[index];
    if (mask === 0) return { opacity: 0 };
    const cid = previewColorShared.value;
    const color = cid > 0 && cid <= cellColors.length ? cellColors[cid - 1] : '#FFFFFF';
    if ((mask & 1) !== 0) {
      return {
        opacity: (mask & 2) !== 0 ? 0.7 : 0.45,
        backgroundColor: color,
      };
    }
    return { opacity: 0.3, backgroundColor: '#FFFFFF' };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: c * step,
          top: r * step,
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
        },
        cellAnimStyle,
      ]}
    >
      {colorId === 0 ? (
        <View
          style={{
            flex: 1,
            backgroundColor: emptyColor,
            borderRadius: radius,
            borderWidth: ctx.cellLine ? 1 : 0,
            borderColor: ctx.cellLine,
          }}
        />
      ) : (
        <Block size={size} color={fillColor} />
      )}
      {/* Превью overlay — только transform/opacity/backgroundColor (спека 07) */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: radius,
            opacity: 0,
          },
          previewStyle,
        ]}
        pointerEvents="none"
      />
    </Animated.View>
  );
});
