/**
 * useDrag — хук жеста Pan для фигуры в трее.
 * Весь drag на UI-потоке (worklet); RN runtime вызывается только на границах жеста.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  useAnimatedStyle,
  useAnimatedReaction,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TRAY_MOTION } from '../animation/motion';
import { dropCommitFor } from './dropLifecycle';
import {
  dragTopLefts,
  dropValidity,
  EMPTY_MASK,
  invalidDropMask,
  previewMask,
  topLeftToCell,
} from './gridMath';
import type { DragCtx } from './DragContext';

const IOS_SHADOW = Platform.OS === 'ios';

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
  /** Refreshes infrequent window geometry and the board snapshot at gesture start. */
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
  reducedMotion?: boolean;
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
  reducedMotion = false,
}: UseDragOptions) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lift = useSharedValue(0);
  const invalidShake = useSharedValue(0);
  const scale = useSharedValue<number>(restingScale);
  const latestRestingScale = useSharedValue(restingScale);
  const gestureActive = useSharedValue(false);
  const touchReleased = useSharedValue(false);
  const releaseHandled = useSharedValue(false);
  const shadowOpacity = useSharedValue(0);

  // A recycled slot or a resized playfield can change the fitted scale without
  // remounting this hook. Keep idle art fitted; active gestures retain control.
  useEffect(() => {
    latestRestingScale.value = restingScale;
    if (!gestureActive.value)
      scale.value = withTiming(restingScale, {
        duration: reducedMotion ? 0 : 140,
      });
  }, [gestureActive, latestRestingScale, reducedMotion, restingScale, scale]);

  // Текущая валидная позиция дропа (shared, для onEnd)
  const queuedR = useSharedValue(-1);
  const queuedC = useSharedValue(-1);
  const checkedBoardRevision = useSharedValue(-1);
  const dropR = useSharedValue(-1);
  const dropC = useSharedValue(-1);
  // 1 — фигура над доской, но позиция занята/не влезает (для Reject-хаптики)
  const dropBlocked = useSharedValue(0);
  const hoverR = useSharedValue(-99);
  const hoverC = useSharedValue(-99);
  const dropCommitted = useSharedValue(0);
  const previewA = useSharedValue<number[]>(new Array(64).fill(0));
  const previewB = useSharedValue<number[]>(new Array(64).fill(0));
  const previewScratch = useSharedValue<number[]>(new Array(64).fill(0));
  const previewFlip = useSharedValue(0);
  const invalidA = useSharedValue<number[]>(new Array(64).fill(0));
  const invalidB = useSharedValue<number[]>(new Array(64).fill(0));
  const invalidFlip = useSharedValue(0);
  const previousDisabled = useRef(disabled);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Захваченные значения для worklet
  const cellsCapture = cells as readonly (readonly [number, number])[];
  const {
    geom,
    boardOrigin,
    boardMirror,
    preview,
    previewColor,
    invalidPreview,
    invalidReason,
    clearPrelude,
    dragActive,
    dragOwner,
    onDrop,
    onGrab,
    onTouch,
    onReturn,
    onInvalidDrop,
  } = ctx;

  const PIECE_LIFT_PX = geom.cell * 1.5;
  const landingActive = ctx.handoff?.active;
  const landingOwner = ctx.handoff?.owner;
  const boardRevision = ctx.boardRevision;
  const landingSerial = ctx.handoff?.serial;
  const landingProgress = ctx.handoff?.progress;
  const landingPiece = ctx.handoff?.piece;
  const jewelMarkers = ctx.jewelMarkers ?? [];
  const landingColor = ctx.cellColors[Math.max(0, colorId - 1)] ?? '#FFFFFF';

  const onDropJS = useCallback(
    (ti: number, r: number, c: number, token = 0) => {
      if (!mounted.current) return;
      // Registered before the engine update: the board's layout effect is the
      // receipt, rather than a timer guessing when React has painted.
      if (ctx.handoff) ctx.handoff.pending.current = token;
      const placed = onDrop(ti, r, c);
      // Дроп оптимистично прячет фигуру (committedOpacity=0). Если движок его
      // отклонил (позиция занята) — слот остаётся прежним и без отката фигура
      // «пропала бы» из трея. Возвращаем её видимой.
      if (!placed) {
        preview.value = EMPTY_MASK;
        previewColor.value = 0;
        clearPrelude.value = 0;
        if (ctx.handoff && token) {
          const { active, progress, piece, pending } = ctx.handoff;
          pending.current = 0;
          const sm = slotMeasure.value;
          piece.value = {
            ...piece.value,
            fromX: sm.x + sm.width / 2 - boardOrigin.value.x,
            fromY: sm.y + sm.height / 2 - boardOrigin.value.y,
            scale: restingScale,
          };
          progress.value = withTiming(
            0,
            { duration: TRAY_MOTION.returnDurationMs },
            (finished) => {
              if (finished) {
                active.value = 0;
                committedOpacity.value = 1;
              }
            },
          );
        } else
          committedOpacity.value = withTiming(1, {
            duration: TRAY_MOTION.appearDurationMs,
          });
        onInvalidDrop?.('occupied');
      }
    },
    [
      boardOrigin,
      clearPrelude,
      committedOpacity,
      ctx.handoff,
      onDrop,
      onInvalidDrop,
      preview,
      previewColor,
      restingScale,
      slotMeasure,
    ],
  );

  const startLanding = (row: number, col: number) => {
    'worklet';
    queuedR.value = -1;
    queuedC.value = -1;
    if (landingActive && landingSerial && landingProgress && landingPiece) {
      const figW = w * geom.cell + (w - 1) * geom.gap;
      const figH = h * geom.cell + (h - 1) * geom.gap;
      const sm = slotMeasure.value;
      const token = landingSerial.value + 1;
      landingSerial.value = token;
      if (landingOwner) landingOwner.value = trayIndex;
      landingPiece.value = {
        cells: cellsCapture,
        jewels: jewelMarkers
          .filter((marker) => marker.slot === trayIndex)
          .map((marker) => marker.cell),
        color: landingColor,
        fromX: sm.x + sm.width / 2 + translateX.value - boardOrigin.value.x,
        fromY:
          sm.y +
          sm.height / 2 +
          translateY.value -
          lift.value -
          boardOrigin.value.y,
        toX: geom.pad + col * (geom.cell + geom.gap) + figW / 2,
        toY: geom.pad + row * (geom.cell + geom.gap) + figH / 2,
        width: figW,
        height: figH,
        scale: scale.value,
      };
      landingProgress.value = 0;
      landingActive.value = token;
      landingProgress.value = withTiming(
        1,
        { duration: reducedMotion ? 0 : 140, easing: Easing.linear },
        (finished) => {
          if (finished) scheduleOnRN(onDropJS, trayIndex, row, col, token);
        },
      );
    } else scheduleOnRN(onDropJS, trayIndex, row, col);
    // Мгновенно прячем фигуру: иначе при сбросе translate в 0 она на 1–2
    // кадра «телепортируется» в слот трея, пока store не обнулит/обновит слот.
    committedOpacity.value = 0;
    // translate сбрасываем для случая переиспользования слота (последняя
    // фигура — трей сразу рефилится): новая фигура должна встать по центру.
    translateX.value = 0;
    translateY.value = 0;
    lift.value = 0;
    scale.value = latestRestingScale.value;
    shadowOpacity.value = 0;
  };

  useAnimatedReaction(
    () => queuedR.value >= 0 && !landingActive?.value,
    (ready) => {
      if (ready) startLanding(queuedR.value, queuedC.value);
    },
  );

  const onTouchJS = onTouch;
  const onReturnJS = onReturn;
  const onGrabJS = onGrab;
  const onInvalidDropJS = onInvalidDrop;

  // A fullscreen ad can suspend Android while RNGH is finalizing the losing
  // gesture. The same tray pieces survive revive, so do not let an interrupted
  // native handler keep ownership/translation when their availability flips.
  useEffect(() => {
    if (previousDisabled.current === disabled) return;
    previousDisabled.current = disabled;
    if (
      queuedR.value >= 0 ||
      (landingActive?.value && landingOwner?.value === trayIndex)
    )
      return;

    queuedR.value = -1;
    queuedC.value = -1;
    translateX.value = 0;
    translateY.value = 0;
    lift.value = 0;
    scale.value = restingScale;
    shadowOpacity.value = 0;
    dropR.value = -1;
    dropC.value = -1;
    dropBlocked.value = 0;
    hoverR.value = -99;
    hoverC.value = -99;
    dropCommitted.value = 0;
    gestureActive.value = false;
    touchReleased.value = false;
    releaseHandled.value = false;

    if (dragOwner.value === trayIndex) {
      dragOwner.value = -1;
      dragActive.value = 0;
      preview.value = EMPTY_MASK;
      previewColor.value = 0;
      invalidPreview.value = EMPTY_MASK;
      invalidReason.value = 0;
      clearPrelude.value = 0;
    }
  }, [
    clearPrelude,
    disabled,
    dragActive,
    dragOwner,
    dropBlocked,
    dropC,
    dropCommitted,
    dropR,
    gestureActive,
    hoverC,
    hoverR,
    invalidPreview,
    invalidReason,
    lift,
    landingActive,
    landingOwner,
    preview,
    previewColor,
    queuedR,
    queuedC,
    releaseHandled,
    restingScale,
    scale,
    shadowOpacity,
    touchReleased,
    translateX,
    translateY,
    trayIndex,
  ]);

  // Pointer input, pickup lift and a concurrent board commit all share the same
  // preview calculation. No RN callback is needed while a finger stands still.
  const refreshPreview = () => {
    'worklet';
    if (!gestureActive.value) return;
    // Превью и валидную позицию дропа ведёт только владелец: при мультитаче
    // чужая фигура следует за пальцем, но не пишет тень и не ставится.
    if (dragOwner.value !== trayIndex) return;

    const cellPx = geom.cell;
    const gapPx = geom.gap;

    // Размер фигуры при scale=1
    const figW = w * cellPx + (w > 1 ? (w - 1) * gapPx : 0);
    const figH = h * cellPx + (h > 1 ? (h - 1) * gapPx : 0);

    const sm = slotMeasure.value;
    const topLeft = dragTopLefts({
      slot: sm,
      translationX: translateX.value,
      translationY: translateY.value,
      figureWidth: figW,
      figureHeight: figH,
      pieceLiftPx: lift.value,
    });

    const { r, c } = topLeftToCell(topLeft.preview.x, topLeft.preview.y, {
      boardX: boardOrigin.value.x,
      boardY: boardOrigin.value.y,
      pad: geom.pad,
      cell: cellPx,
      gap: gapPx,
    });

    const validity = dropValidity(boardMirror.value, cellsCapture, r, c, w, h);
    const positionChanged =
      hoverR.value !== r ||
      hoverC.value !== c ||
      checkedBoardRevision.value !== (boardRevision?.value ?? 0);
    checkedBoardRevision.value = boardRevision?.value ?? 0;
    hoverR.value = r;
    hoverC.value = c;

    if (validity === 'valid') {
      dropR.value = r;
      dropC.value = c;
      dropBlocked.value = 0;
      invalidReason.value = 0;
      invalidPreview.value = EMPTY_MASK;
      if (positionChanged) {
        previewFlip.value = previewFlip.value === 0 ? 1 : 0;
        const nextPreview =
          previewFlip.value === 0 ? previewA.value : previewB.value;
        preview.value = previewMask(
          boardMirror.value,
          cellsCapture,
          r,
          c,
          nextPreview,
          previewScratch.value,
        );
        previewColor.value = colorId;
      }
    } else {
      const hadPreview = dropR.value >= 0 || dropC.value >= 0;
      dropR.value = -1;
      dropC.value = -1;
      dropBlocked.value = validity === 'occupied' ? 1 : 0;
      invalidReason.value = validity === 'occupied' ? 1 : 2;
      if (validity === 'occupied' && positionChanged) {
        invalidFlip.value = invalidFlip.value === 0 ? 1 : 0;
        const nextInvalid =
          invalidFlip.value === 0 ? invalidA.value : invalidB.value;
        invalidPreview.value = invalidDropMask(
          boardMirror.value,
          cellsCapture,
          r,
          c,
          nextInvalid,
        );
      } else if (validity === 'outside-board') {
        invalidPreview.value = EMPTY_MASK;
      }
      if (hadPreview) {
        preview.value = EMPTY_MASK;
        previewColor.value = 0;
      }
    }
  };
  useAnimatedReaction(
    () => [
      gestureActive.value && dragOwner.value === trayIndex ? 1 : 0,
      translateX.value,
      translateY.value,
      lift.value,
      boardRevision?.value ?? 0,
      boardOrigin.value.x,
      boardOrigin.value.y,
      slotMeasure.value.x,
      slotMeasure.value.y,
      slotMeasure.value.width,
      slotMeasure.value.height,
    ],
    (pose) => {
      if (pose[0]) refreshPreview();
    },
  );

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      if (
        queuedR.value >= 0 ||
        (landingActive?.value && landingOwner?.value === trayIndex)
      )
        return;
      gestureActive.value = true;
      touchReleased.value = false;
      releaseHandled.value = false;
      if (onTouchJS) scheduleOnRN(onTouchJS);
      // Перф-сигнал: drag начался — мозг маскота встаёт на паузу (спека 09).
      // Visual lift and activated-drag tracking remain in onStart.
      dragActive.value = 1;
    })
    .onTouchesUp((event) => {
      'worklet';
      touchReleased.value = event.numberOfTouches === 0;
    })
    .onStart(() => {
      'worklet';
      if (!gestureActive.value) return;
      scheduleOnRN(measureForDrag);
      // Подстраховка: чистим возможную «застрявшую» тень от прерванного жеста и
      // забираем владение превью (last-wins — переживает залипшего владельца).
      preview.value = EMPTY_MASK;
      previewColor.value = 0;
      invalidPreview.value = EMPTY_MASK;
      invalidReason.value = 0;
      clearPrelude.value = 0;
      dropCommitted.value = 0;
      dragOwner.value = trayIndex;
      scale.value = withTiming(TRAY_MOTION.grabScale, {
        duration: reducedMotion ? 0 : TRAY_MOTION.grabDurationMs,
      });
      lift.value = withTiming(PIECE_LIFT_PX, {
        duration: reducedMotion ? 0 : TRAY_MOTION.grabDurationMs,
      });
      shadowOpacity.value = withTiming(0.3, {
        duration: reducedMotion ? 0 : TRAY_MOTION.grabDurationMs,
      });
      if (onGrabJS) scheduleOnRN(onGrabJS);
      dropR.value = -1;
      dropC.value = -1;
      dropBlocked.value = 0;
      hoverR.value = -99;
      hoverC.value = -99;
    })
    .onUpdate((event) => {
      'worklet';
      if (!gestureActive.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;

      refreshPreview();
    })
    // RNGH registers this callback; it runs after release, never during render.
    // eslint-disable-next-line react-hooks/refs
    .onEnd((event, success) => {
      'worklet';
      if (!gestureActive.value) return;
      releaseHandled.value = true;
      if (!success) return;
      const isOwner = dragOwner.value === trayIndex;
      if (isOwner) {
        if (typeof event.translationX === 'number')
          translateX.value = event.translationX;
        if (typeof event.translationY === 'number')
          translateY.value = event.translationY;
        refreshPreview();
      }
      const commit = isOwner
        ? dropCommitFor(trayIndex, dropR.value, dropC.value)
        : null;

      if (commit) {
        // Immediate causal feedback stays on the UI runtime. The already-built
        // line preview bridges the RN/store/render round-trip until the pooled
        // destruction layers take over in the accepted-drop commit.
        dropCommitted.value = 1;
        clearPrelude.value = 0;
        // Only a completed line needs the board-wide pulse. A normal placement
        // already has its cell settle; waking all preview mappers adds no feedback.
        if (preview.value.some((mask) => (mask & 2) !== 0)) {
          clearPrelude.value = withSequence(
            withTiming(1, { duration: 55 }),
            withTiming(0, { duration: 110 }),
          );
        }
        if (landingActive?.value) {
          queuedR.value = commit.row;
          queuedC.value = commit.col;
        } else startLanding(commit.row, commit.col);
      } else {
        if (isOwner) {
          preview.value = EMPTY_MASK;
          previewColor.value = 0;
          clearPrelude.value = 0;
        }
        if (!reducedMotion && isOwner && dropBlocked.value === 1) {
          invalidShake.value = withSequence(
            withTiming(-9, { duration: 24 }),
            withTiming(8, { duration: 24 }),
            withTiming(-6, { duration: 24 }),
            withTiming(4, { duration: 24 }),
            withTiming(-2, { duration: 24 }),
            withTiming(0, { duration: 24 }),
          );
        }
        // Preserve release velocity while settling back into the tray.
        if (isOwner && onInvalidDropJS) {
          scheduleOnRN(
            onInvalidDropJS,
            dropBlocked.value === 1 ? 'occupied' : 'outside-board',
          );
        }
        if (!isOwner && onReturnJS) scheduleOnRN(onReturnJS);
        translateX.value = withTiming(0, {
          duration: TRAY_MOTION.returnDurationMs,
          easing: Easing.out(Easing.cubic),
        });
        translateY.value = withTiming(0, {
          duration: TRAY_MOTION.returnDurationMs,
          easing: Easing.out(Easing.cubic),
        });
        lift.value = withTiming(0, {
          duration: TRAY_MOTION.returnDurationMs,
          easing: Easing.out(Easing.cubic),
        });
        scale.value = withTiming(latestRestingScale.value, {
          duration: TRAY_MOTION.returnScaleDurationMs,
        });
        shadowOpacity.value = withTiming(0, {
          duration: TRAY_MOTION.returnScaleDurationMs,
        });
      }
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!gestureActive.value) return;
      if (touchReleased.value && !releaseHandled.value && onReturnJS) {
        scheduleOnRN(onReturnJS);
      }
      releaseHandled.value = true;
      // Чистим превью и отпускаем владение только если владелец — иначе затрём
      // активную тень другого (ещё перетаскиваемого) пальца.
      const committed = dropCommitted.value === 1;
      if (dragOwner.value === trayIndex) {
        if (!committed) {
          preview.value = EMPTY_MASK;
          previewColor.value = 0;
          invalidPreview.value = EMPTY_MASK;
          invalidReason.value = 0;
          clearPrelude.value = 0;
        }
        if (queuedR.value < 0) dragOwner.value = -1;
        dragActive.value = 0;
      } else if (dragOwner.value < 0) {
        dragActive.value = 0;
      }

      // Если жест был отменён/перехвачен (не был onEnd) — возвращаем в слот
      if (!success) {
        dropR.value = -1;
        dropC.value = -1;
        dropBlocked.value = 0;
        hoverR.value = -99;
        hoverC.value = -99;
        invalidPreview.value = EMPTY_MASK;
        invalidReason.value = 0;
        translateX.value = withSpring(0, {
          duration: TRAY_MOTION.returnDurationMs,
          dampingRatio: 1,
          overshootClamping: true,
        });
        translateY.value = withSpring(0, {
          duration: TRAY_MOTION.returnDurationMs,
          dampingRatio: 1,
          overshootClamping: true,
        });
        lift.value = withTiming(0, { duration: TRAY_MOTION.returnDurationMs });
        scale.value = withTiming(latestRestingScale.value, {
          duration: TRAY_MOTION.returnScaleDurationMs,
        });
        shadowOpacity.value = withTiming(0, {
          duration: TRAY_MOTION.returnScaleDurationMs,
        });
      } else {
        // onEnd уже отработал — только сбрасываем drop-позицию
        dropR.value = -1;
        dropC.value = -1;
        dropBlocked.value = 0;
        hoverR.value = -99;
        hoverC.value = -99;
        invalidPreview.value = EMPTY_MASK;
        invalidReason.value = 0;
      }
      dropCommitted.value = 0;
      gestureActive.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity:
      gestureActive.value || queuedR.value >= 0 ? 1 : disabled ? 0.35 : 1,
    transform: [
      { translateX: translateX.value + invalidShake.value },
      { translateY: translateY.value - lift.value },
      { scale: scale.value },
    ],
    // Android must receive only supported native-prop updates during a drag.
    // iOS shadow fields would force the entire transform update through Fabric.
    ...(IOS_SHADOW
      ? {
          shadowColor: '#000',
          shadowOpacity: shadowOpacity.value,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 6 },
        }
      : {}),
  }));

  return { gesture, animatedStyle };
}
