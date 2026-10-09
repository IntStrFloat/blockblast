import { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
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
  placementDelayMs?: number;
}

export const BoardCell = memo(function BoardCell({
  index,
  colorId,
  size,
  gap,
  fillColor,
  emptyColor,
  reducedMotion,
  placementDelayMs = 0,
}: BoardCellProps) {
  const ctx = useDragCtx();
  const r = (index / 8) | 0;
  const c = index % 8;
  const step = size + gap;
  const radius = ctx.cellRadius ?? (ctx.cellLine ? 2 : radii.cell);

  // A short settle confirms placement without making the block jump out of its cell.
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
      placedScale.value = 1;
      placedScale.value = withDelay(
        placementDelayMs,
        withSequence(
          withTiming(1.06, { duration: 35 }),
          withTiming(1.0, { duration: 85 }),
        ),
      );
    }
  }, [colorId, placedScale, placementDelayMs, reducedMotion]);

  // Стиль базовой ячейки с анимацией размещения
  const cellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: placedScale.value }],
  }));

  // Превью drag — читаем shared values напрямую (ноль ре-рендеров)
  const cellColors = ctx.cellColors;
  const previewShared = ctx.preview;
  const previewColorShared = ctx.previewColor;
  const assistPreviewShared = ctx.assistPreview;
  const assistPreviewColorShared = ctx.assistPreviewColor;
  const clearPreludeShared = ctx.clearPrelude;
  const invalidPreviewShared = ctx.invalidPreview;

  const previewStyle = useAnimatedStyle(() => {
    const dragMask = previewShared.value[index];
    const assistMask = assistPreviewShared?.value[index] ?? 0;
    const mask = dragMask !== 0 ? dragMask : assistMask;
    const prelude = clearPreludeShared.value;
    if (mask === 0) {
      return { opacity: 0, borderWidth: 0, transform: [{ scale: 1 }] };
    }
    const cid = dragMask !== 0
      ? previewColorShared.value
      : (assistPreviewColorShared?.value ?? 0);
    const color = cid > 0 && cid <= cellColors.length ? cellColors[cid - 1] : '#FFFFFF';
    if ((mask & 1) !== 0) {
      const completesLine = (mask & 2) !== 0;
      return {
        opacity: completesLine ? 0.7 + prelude * 0.25 : 0.45,
        backgroundColor: color,
        borderWidth: completesLine ? 1 + prelude * 2 : 0,
        borderColor: 'rgba(255,255,255,0.92)',
        transform: [{ scale: completesLine ? 1 + prelude * 0.045 : 1 }],
      };
    }
    return {
      opacity: 0.3 + prelude * 0.55,
      backgroundColor: '#FFFFFF',
      borderWidth: 1 + prelude * 2,
      borderColor: 'rgba(255,255,255,0.96)',
      transform: [{ scale: 1 + prelude * 0.045 }],
    };
  });

  const invalidStyle = useAnimatedStyle(() => {
    const code = invalidPreviewShared.value[index];
    return {
      opacity: code > 0 ? 1 : 0,
      backgroundColor: code === 2 ? 'rgba(255,177,36,0.32)' : 'rgba(255,255,255,0.08)',
      transform: [{ scale: code === 2 ? 0.94 : 1 }],
    };
  });
  const conflictMarkStyle = useAnimatedStyle(() => ({
    opacity: invalidPreviewShared.value[index] === 2 ? 0.95 : 0,
  }));

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
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            inset: 1,
            borderRadius: Math.max(1, radius - 1),
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: '#FFF4C7',
          },
          invalidStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: '20%',
              top: '48%',
              width: '60%',
              height: 2,
              borderRadius: 1,
              backgroundColor: '#3B2400',
              transform: [{ rotate: '45deg' }],
            },
            conflictMarkStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: '20%',
              top: '48%',
              width: '60%',
              height: 2,
              borderRadius: 1,
              backgroundColor: '#3B2400',
              transform: [{ rotate: '-45deg' }],
            },
            conflictMarkStyle,
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
});
