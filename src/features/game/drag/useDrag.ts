/**
 * useDrag — хук жеста Pan для фигуры в трее.
 * Весь drag на UI-потоке (worklet); runOnJS ровно один раз — на дроп (спека 07).
 */
import { useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { EMPTY_MASK, fitsOnBoard, previewMask, topLeftToCell } from './gridMath';
import type { DragCtx } from './DragContext';

/** Позиция слота в координатах окна — снимается на measureInWindow */
export interface SlotMeasure {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseDragOptions {
  trayIndex: number;
  /** cells фигуры — [row, col][] относительно bbox */
  cells: ReadonlyArray<readonly [number, number]>;
  w: number;
  h: number;
  colorId: number;
  /** Фигура заблокирована (не влезает) — жест отключён */
  disabled: boolean;
  ctx: DragCtx;
  /** SharedValue позиции слота в окне (measureInWindow на layout) */
  slotMeasure: SharedValue<SlotMeasure>;
}

export function useDrag({
  trayIndex,
  cells,
  w,
  h,
  colorId,
  disabled,
  ctx,
  slotMeasure,
}: UseDragOptions) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.65);
  // Тень при захвате: elevation (Android) и shadowOpacity (iOS)
  const elevation = useSharedValue(0);
  const shadowOpacity = useSharedValue(0);

  // Текущая валидная позиция дропа (shared, для onEnd)
  const dropR = useSharedValue(-1);
  const dropC = useSharedValue(-1);

  // Захваченные значения для worklet
  const cellsCapture = cells as ReadonlyArray<readonly [number, number]>;

  const onDropJS = useCallback(
    (ti: number, r: number, c: number) => {
      ctx.onDrop(ti, r, c);
    },
    [ctx],
  );

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(1.0, { damping: 18, stiffness: 360 });
      elevation.value = withTiming(8, { duration: 150 });
      shadowOpacity.value = withTiming(0.3, { duration: 150 });
    })
    .onStart(() => {
      'worklet';
      dropR.value = -1;
      dropC.value = -1;
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      translateY.value = event.translationY - 60;

      const { geom, boardOrigin, boardMirror, preview, previewColor } = ctx;
      const cellPx = geom.cell;
      const gapPx = geom.gap;

      // Размер фигуры при scale=1
      const figW = w * cellPx + (w > 1 ? (w - 1) * gapPx : 0);
      const figH = h * cellPx + (h > 1 ? (h - 1) * gapPx : 0);

      // Центр слота в координатах окна
      const sm = slotMeasure.value;
      const slotCenterX = sm.x + sm.width / 2;
      const slotCenterY = sm.y + sm.height / 2;

      // Top-left фигуры в координатах окна (при scale=1, с подъёмом -60)
      const tlX = slotCenterX + event.translationX - figW / 2;
      const tlY = slotCenterY + event.translationY - 60 - figH / 2;

      const { r, c } = topLeftToCell(tlX, tlY, {
        boardX: boardOrigin.value.x,
        boardY: boardOrigin.value.y,
        pad: geom.pad,
        cell: cellPx,
        gap: gapPx,
      });

      if (fitsOnBoard(boardMirror.value, cellsCapture, r, c, w, h)) {
        dropR.value = r;
        dropC.value = c;
        preview.value = previewMask(boardMirror.value, cellsCapture, r, c);
        previewColor.value = colorId;
      } else {
        dropR.value = -1;
        dropC.value = -1;
        preview.value = EMPTY_MASK;
        previewColor.value = 0;
      }
    })
    .onEnd(() => {
      'worklet';
      ctx.preview.value = EMPTY_MASK;
      ctx.previewColor.value = 0;

      const r = dropR.value;
      const c = dropC.value;

      if (r >= 0 && c >= 0) {
        // Валидный дроп — ровно один runOnJS
        runOnJS(onDropJS)(trayIndex, r, c);
        // Фигура исчезнет из трея через store (tray[trayIndex] = null)
        // translateX/Y сбросим здесь на случай если компонент переиспользуется
        translateX.value = 0;
        translateY.value = 0;
        scale.value = 0.65;
        elevation.value = 0;
        shadowOpacity.value = 0;
      } else {
        // Невалидно — spring назад в слот
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
        scale.value = withTiming(0.65, { duration: 150 });
        elevation.value = withTiming(0, { duration: 150 });
        shadowOpacity.value = withTiming(0, { duration: 150 });
      }
    })
    .onFinalize((_event, success) => {
      'worklet';
      // Всегда чистим превью
      ctx.preview.value = EMPTY_MASK;
      ctx.previewColor.value = 0;

      // Если жест был отменён/перехвачен (не был onEnd) — возвращаем в слот
      if (!success) {
        dropR.value = -1;
        dropC.value = -1;
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
        scale.value = withTiming(0.65, { duration: 150 });
        elevation.value = withTiming(0, { duration: 150 });
        shadowOpacity.value = withTiming(0, { duration: 150 });
      } else {
        // onEnd уже отработал — только сбрасываем drop-позицию
        dropR.value = -1;
        dropC.value = -1;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    // Android — elevation анимируется
    elevation: elevation.value,
    // iOS — shadowOpacity анимируется, остальные статичны
    shadowColor: '#000',
    shadowOpacity: shadowOpacity.value,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  }));

  return { gesture, animatedStyle };
}
