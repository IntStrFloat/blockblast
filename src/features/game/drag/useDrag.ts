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
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { TRAY_MOTION } from '../animation/motion';
import { dropCommitFor } from './dropLifecycle';
import {
  dragTopLefts,
  EMPTY_MASK,
  fitsOnBoard,
  previewMask,
  topLeftToCell,
} from './gridMath';
import type { DragCtx } from './DragContext';

const PIECE_LIFT_PX = 60;
// Подъём превью над фигурой, в «рядах» доски (cell+gap). Превью должно быть лишь
// чуть выше самой фигуры — как в оригинальном Block Blast.
const PREVIEW_LIFT_ROWS = 0.15;

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
  cells: readonly (readonly [number, number])[];
  w: number;
  h: number;
  colorId: number;
  /** Фигура заблокирована (не влезает) — жест отключён */
  disabled: boolean;
  ctx: DragCtx;
  /** SharedValue позиции слота в окне (measureInWindow на layout) */
  slotMeasure: SharedValue<SlotMeasure>;
  /** Актуализирует позиции слота и доски непосредственно перед drag */
  measureForDrag: () => void;
  /**
   * Opacity появления фигуры (appearOpacity у TrayPiece). На валидном дропе
   * мгновенно гасим её в 0, чтобы фигура не «телепортировалась» в трей на
   * время round-trip store. При переиспользовании слота appear-эффект вернёт 1.
   */
  committedOpacity: SharedValue<number>;
  /**
   * Масштаб фигуры в покое. Считается под ширину слота (узкие — базовый
   * restingScale, широкие — ужимаются, чтобы не вылезать за слот и не
   * налезать на соседнюю фигуру). На захвате фигура подрастает до grabScale.
   */
  restingScale: number;
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
  measureForDrag,
  committedOpacity,
  restingScale,
}: UseDragOptions) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue<number>(restingScale);
  // Тень при захвате: elevation (Android) и shadowOpacity (iOS)
  const elevation = useSharedValue(0);
  const shadowOpacity = useSharedValue(0);

  // Текущая валидная позиция дропа (shared, для onEnd)
  const dropR = useSharedValue(-1);
  const dropC = useSharedValue(-1);

  // Захваченные значения для worklet
  const cellsCapture = cells as readonly (readonly [number, number])[];

  const onDropJS = useCallback(
    (ti: number, r: number, c: number) => {
      const placed = ctx.onDrop(ti, r, c);
      // Дроп оптимистично прячет фигуру (committedOpacity=0). Если движок его
      // отклонил (позиция занята) — слот остаётся прежним и без отката фигура
      // «пропала бы» из трея. Возвращаем её видимой.
      if (!placed) {
        committedOpacity.value = withTiming(1, { duration: TRAY_MOTION.appearDurationMs });
      }
    },
    [ctx, committedOpacity],
  );

  const onGrabJS = ctx.onGrab;

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      // Перф-сигнал: drag начался — мозг маскота встаёт на паузу (спека 09).
      // Движение/звук захвата — в onStart (см. ниже); здесь только сигнал паузы.
      ctx.dragActive.value = 1;
    })
    .onStart(() => {
      'worklet';
      runOnJS(measureForDrag)();
      // Подстраховка: чистим возможную «застрявшую» тень от прерванного жеста и
      // забираем владение превью (last-wins — переживает залипшего владельца).
      ctx.preview.value = EMPTY_MASK;
      ctx.previewColor.value = 0;
      ctx.dragOwner.value = trayIndex;
      scale.value = withTiming(TRAY_MOTION.grabScale, { duration: TRAY_MOTION.grabDurationMs });
      elevation.value = withTiming(8, { duration: TRAY_MOTION.grabDurationMs });
      shadowOpacity.value = withTiming(0.3, { duration: TRAY_MOTION.grabDurationMs });
      if (onGrabJS) runOnJS(onGrabJS)();
      dropR.value = -1;
      dropC.value = -1;
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      translateY.value = event.translationY - PIECE_LIFT_PX;

      // Превью и валидную позицию дропа ведёт только владелец: при мультитаче
      // чужая фигура следует за пальцем, но не пишет тень и не ставится.
      if (ctx.dragOwner.value !== trayIndex) return;

      const { geom, boardOrigin, boardMirror, preview, previewColor } = ctx;
      const cellPx = geom.cell;
      const gapPx = geom.gap;

      // Размер фигуры при scale=1
      const figW = w * cellPx + (w > 1 ? (w - 1) * gapPx : 0);
      const figH = h * cellPx + (h > 1 ? (h - 1) * gapPx : 0);

      const sm = slotMeasure.value;
      const topLeft = dragTopLefts({
        slot: sm,
        translationX: event.translationX,
        translationY: event.translationY,
        figureWidth: figW,
        figureHeight: figH,
        pieceLiftPx: PIECE_LIFT_PX,
        previewLiftPx: PREVIEW_LIFT_ROWS * (cellPx + gapPx),
      });

      const { r, c } = topLeftToCell(topLeft.preview.x, topLeft.preview.y, {
        boardX: boardOrigin.value.x,
        boardY: boardOrigin.value.y,
        pad: geom.pad,
        cell: cellPx,
        gap: gapPx,
      });

      if (fitsOnBoard(boardMirror.value, cellsCapture, r, c, w, h)) {
        const positionChanged = dropR.value !== r || dropC.value !== c;
        dropR.value = r;
        dropC.value = c;
        if (positionChanged) {
          preview.value = previewMask(boardMirror.value, cellsCapture, r, c);
          previewColor.value = colorId;
        }
      } else {
        const hadPreview = dropR.value >= 0 || dropC.value >= 0;
        dropR.value = -1;
        dropC.value = -1;
        if (hadPreview) {
          preview.value = EMPTY_MASK;
          previewColor.value = 0;
        }
      }
    })
    .onEnd(() => {
      'worklet';
      const isOwner = ctx.dragOwner.value === trayIndex;
      if (isOwner) {
        ctx.preview.value = EMPTY_MASK;
        ctx.previewColor.value = 0;
      }

      const commit = isOwner ? dropCommitFor(trayIndex, dropR.value, dropC.value) : null;

      if (commit) {
        // Валидный дроп — ровно один runOnJS
        runOnJS(onDropJS)(commit.trayIndex, commit.row, commit.col);
        // Мгновенно прячем фигуру: иначе при сбросе translate в 0 она на 1–2
        // кадра «телепортируется» в слот трея, пока store не обнулит/обновит слот.
        committedOpacity.value = 0;
        // translate сбрасываем для случая переиспользования слота (последняя
        // фигура — трей сразу рефилится): новая фигура должна встать по центру.
        translateX.value = 0;
        translateY.value = 0;
        scale.value = restingScale;
        elevation.value = 0;
        shadowOpacity.value = 0;
      } else {
        // Невалидно — короткий timing назад в слот без overshoot
        translateX.value = withTiming(0, { duration: TRAY_MOTION.returnDurationMs });
        translateY.value = withTiming(0, { duration: TRAY_MOTION.returnDurationMs });
        scale.value = withTiming(restingScale, {
          duration: TRAY_MOTION.returnScaleDurationMs,
        });
        elevation.value = withTiming(0, { duration: TRAY_MOTION.returnScaleDurationMs });
        shadowOpacity.value = withTiming(0, { duration: TRAY_MOTION.returnScaleDurationMs });
      }
    })
    .onFinalize((_event, success) => {
      'worklet';
      // Чистим превью и отпускаем владение только если владелец — иначе затрём
      // активную тень другого (ещё перетаскиваемого) пальца.
      if (ctx.dragOwner.value === trayIndex) {
        ctx.preview.value = EMPTY_MASK;
        ctx.previewColor.value = 0;
        ctx.dragOwner.value = -1;
        ctx.dragActive.value = 0;
      } else if (ctx.dragOwner.value < 0) {
        ctx.dragActive.value = 0;
      }

      // Если жест был отменён/перехвачен (не был onEnd) — возвращаем в слот
      if (!success) {
        dropR.value = -1;
        dropC.value = -1;
        translateX.value = withTiming(0, { duration: TRAY_MOTION.returnDurationMs });
        translateY.value = withTiming(0, { duration: TRAY_MOTION.returnDurationMs });
        scale.value = withTiming(restingScale, {
          duration: TRAY_MOTION.returnScaleDurationMs,
        });
        elevation.value = withTiming(0, { duration: TRAY_MOTION.returnScaleDurationMs });
        shadowOpacity.value = withTiming(0, { duration: TRAY_MOTION.returnScaleDurationMs });
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
