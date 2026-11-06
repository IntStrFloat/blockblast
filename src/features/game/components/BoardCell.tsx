import { memo, useLayoutEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolateColor,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { radii } from '@/ui';
import { shouldPulseOnFill } from '../animation/motion';
import type { DragCtx } from '../drag/DragContext';
import { Block } from './Block';

/** Cell art does not subscribe to drop callbacks or the screen's playing phase. */
export type BoardCellVisuals = Pick<
  DragCtx,
  | 'cellColors'
  | 'cellLine'
  | 'cellRadius'
  | 'preview'
  | 'previewColor'
  | 'assistPreview'
  | 'assistPreviewColor'
  | 'clearPrelude'
  | 'invalidPreview'
  | 'handoff'
  | 'noMovesWave'
  | 'dragActive'
> & { previewPulse?: SharedValue<number>; hintPulse?: SharedValue<number> };

interface BoardCellProps {
  index: number;
  colorId: number;
  size: number;
  gap: number;
  fillColor: string; // cellColors[colorId-1], пустая строка если colorId=0
  emptyColor: string;
  reducedMotion: boolean;
  placementDelayMs?: number;
  visuals: BoardCellVisuals;
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
  visuals: ctx,
}: BoardCellProps) {
  const r = (index / 8) | 0;
  const c = index % 8;
  const step = size + gap;
  const radius =
    ctx.cellRadius ?? Math.max(radii.cell, Math.round(size * 0.22));

  // A short settle confirms placement without making the block jump out of its cell.
  // Триггер — переход пусто → блок. Маунт уже заполненной ячейки (резюм
  // сохранённой партии) не пульсирует — иначе вся доска «выстреливает» разом.
  const placedScale = useSharedValue(1);
  const prevColorIdRef = useRef(colorId);
  useLayoutEffect(() => {
    const prevColorId = prevColorIdRef.current;
    prevColorIdRef.current = colorId;
    if (shouldPulseOnFill(prevColorId, colorId)) {
      if (reducedMotion || ctx.handoff?.pending.current) {
        placedScale.value = 1;
        return;
      }
      placedScale.value = 0.9;
      placedScale.value = withDelay(
        placementDelayMs,
        withSequence(
          withTiming(1.06, { duration: 65 }),
          withTiming(1.0, { duration: 75 }),
        ),
      );
    }
  }, [colorId, ctx.handoff, placedScale, placementDelayMs, reducedMotion]);

  // Стиль базовой ячейки с анимацией размещения
  const cellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: placedScale.value }],
  }));

  const noMovesWave = ctx.noMovesWave;
  const filledStyle = useAnimatedStyle(() => {
    const progress = Math.max(
      0,
      Math.min(1, (noMovesWave?.value ?? 0) * 8 - (7 - r)),
    );
    return {
      backgroundColor:
        colorId > 0
          ? progress > 0
            ? interpolateColor(progress, [0, 1], [fillColor, '#717591'])
            : fillColor
          : emptyColor,
    };
  });

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
    const guiding = !ctx.dragActive?.value && !ctx.handoff?.active.value;
    const assistMask = guiding ? (assistPreviewShared?.value[index] ?? 0) : 0;
    const mask = dragMask !== 0 ? dragMask : assistMask;
    const prelude = clearPreludeShared.value;
    const pulse = reducedMotion
      ? 1
      : 0.5 - 0.5 * Math.cos((ctx.previewPulse?.value ?? 0) * Math.PI * 2);
    if (mask === 0) {
      return { opacity: 0, borderWidth: 0, transform: [{ scale: 1 }] };
    }
    const cid =
      dragMask !== 0
        ? previewColorShared.value
        : (assistPreviewColorShared?.value ?? 0);
    const color =
      cid > 0 && cid <= cellColors.length ? cellColors[cid - 1] : '#FFFFFF';
    if (dragMask === 0 && assistMask !== 0) {
      return {
        opacity: (mask & 1) !== 0 ? 0.58 + (ctx.hintPulse?.value ?? 1) * 0.2 : 0.72,
        backgroundColor: (mask & 1) !== 0 ? color : 'rgba(255,201,60,0.08)',
        borderWidth: 3,
        borderStyle: 'dashed' as const,
        borderColor: '#FFC93C',
        transform: [{ scale: 1 }],
      };
    }
    if ((mask & 1) !== 0) {
      const completesLine = (mask & 2) !== 0;
      return {
        opacity: completesLine ? Math.max(0.82 + pulse * 0.18, prelude) : 0.38,
        backgroundColor: color,
        borderWidth: 2,
        borderStyle: 'solid' as const,
        borderColor: completesLine ? 'rgba(255,255,255,0.92)' : color,
        transform: [{ scale: completesLine ? 1 + prelude * 0.045 : 1 }],
      };
    }
    return {
      opacity: 0.65 + pulse * 0.25,
      // Existing blocks retain their colors; only the legal new footprint is filled.
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 2,
      borderStyle: 'solid' as const,
      borderColor: 'rgba(255,255,255,0.96)',
      transform: [{ scale: 1 }],
    };
  });

  const invalidStyle = useAnimatedStyle(() => {
    const code = invalidPreviewShared.value[index];
    return {
      opacity: code > 0 ? 1 : 0,
      backgroundColor: 'rgba(255,79,106,0.38)',
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
            borderTopWidth: 2,
            borderColor: ctx.cellLine,
            borderTopColor: 'rgba(5,8,40,0.22)',
          }}
        />
      ) : (
        <Block size={size} color={fillColor} style={filledStyle} />
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
            borderStyle: 'solid',
            borderColor: '#FF4F6A',
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
              backgroundColor: '#FFFFFF',
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
              backgroundColor: '#FFFFFF',
              transform: [{ rotate: '-45deg' }],
            },
            conflictMarkStyle,
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
});
