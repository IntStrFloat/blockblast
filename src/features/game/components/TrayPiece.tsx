import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { hasPlacement } from '@/core/engine';
import type { PieceInstance } from '@/core/engine';
import {
  TRAY_ACTIVATION,
  TRAY_MOTION,
  trayRestingScale,
} from '../animation/motion';
import { useHintPulse } from '../animation/useHintPulse';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useDragCtx } from '../drag/DragContext';
import type { SlotMeasure } from '../drag/useDrag';
import { useDrag } from '../drag/useDrag';
import { useGameStore } from '../store';
import { Block } from './Block';

interface TrayPieceProps {
  piece: PieceInstance;
  trayIndex: number;
  renderCellOverlay?: (
    cellIndex: number,
    cellSizePx: number,
  ) => React.ReactNode;
  readyToken?: string | null;
  onInteractiveReady?: (trayIndex: number, token: string) => void;
}

export function TrayPiece({
  piece,
  trayIndex,
  renderCellOverlay,
  readyToken = null,
  onInteractiveReady,
}: TrayPieceProps) {
  const reducedMotion = useReducedMotion();
  const ctx = useDragCtx();
  const { geom, cellColors } = ctx;
  const { boardMirror, measureBoard } = ctx;
  const { cell } = geom;
  const trayCellGap = geom.gap;

  const board = useGameStore((s) => s.game.board);
  const { shape, colorId } = piece;
  const { cells, w, h } = shape;

  const color =
    colorId > 0 && colorId <= cellColors.length
      ? cellColors[colorId - 1]
      : '#FFFFFF';

  // Определяем, влезает ли фигура хоть куда-нибудь
  const disabled = !hasPlacement(board, shape);
  const hinted = useGameStore((s) => s.helperHint?.trayIndex === trayIndex && s.game.tray[trayIndex] === piece);
  const hintPulse = useHintPulse(hinted, reducedMotion);
  const dragActive = ctx.dragActive;
  const landingActive = ctx.handoff?.active;
  const hintStyle = useAnimatedStyle(() => ({
    opacity: hinted && !dragActive?.value && !landingActive?.value ? 0.6 + hintPulse.value * 0.4 : 0,
  }));

  // SharedValue для позиции слота (measureInWindow снимается заранее на JS)
  const slotMeasure = useSharedValue<SlotMeasure>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const containerRef = useRef<View>(null);
  const appearScale = useSharedValue<number>(TRAY_MOTION.appearFromScale);
  const appearOpacity = useSharedValue<number>(0.7);

  // Зависим от идентичности фигуры (новый PieceInstance на каждой выдаче), а не
  // от shape.id+colorId: иначе при рефилле слота такой же формой того же цвета
  // эффект не срабатывал и фигура оставалась невидимой (committedOpacity=0).
  useEffect(() => {
    appearScale.value = reducedMotion ? 1 : TRAY_MOTION.appearFromScale;
    appearOpacity.value = 0.7;
    appearScale.value = withTiming(1, {
      duration: TRAY_MOTION.appearDurationMs,
    });
    appearOpacity.value = withTiming(1, {
      duration: TRAY_MOTION.appearDurationMs,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece, reducedMotion]);

  const appearStyle = useAnimatedStyle(() => ({
    opacity: appearOpacity.value,
    transform: [{ scale: appearScale.value }],
  }));

  // Полный размер фигуры при scale=1
  const figW = w * cell + (w > 1 ? (w - 1) * trayCellGap : 0);
  const figH = h * cell + (h > 1 ? (h - 1) * trayCellGap : 0);

  // Масштаб в покое под реальный слот. Endless: трей = 100% экрана,
  // paddingHorizontal 8, три равных слота → фолбэк (screenWidth-16)/3, высота не
  // ограничивает (трей заведомо выше фигур). Adventure передаёт ctx.trayFit с
  // реальными шириной/высотой слота (трей уже экрана + крупная клетка), чтобы
  // широкие фигуры не налезали на соседей, а высокие — не вылезали за трей.
  const { width: screenWidth } = useWindowDimensions();
  const slotWidth = ctx.trayFit?.slotWidth ?? (screenWidth - 16) / 3;
  const slotHeight = ctx.trayFit?.slotHeight;
  const restingScale = trayRestingScale(
    figW,
    figH,
    slotWidth,
    slotHeight,
    undefined,
    undefined,
    ctx.trayFit?.restingScale,
  );

  const measureSlot = useCallback(() => {
    // measureInWindow нельзя вызывать в worklet — снимаем на JS при layout
    containerRef.current?.measureInWindow((x, y, width, height) => {
      slotMeasure.value = { x, y, width, height };
    });
  }, [slotMeasure]);

  const measureForDrag = useCallback(() => {
    measureSlot();
    measureBoard();
    boardMirror.value = [...useGameStore.getState().game.board];
  }, [boardMirror, measureBoard, measureSlot]);

  useEffect(() => {
    if (!readyToken || !onInteractiveReady) return;
    let active = true;
    const frame = requestAnimationFrame(() => {
      containerRef.current?.measureInWindow((x, y, width, height) => {
        slotMeasure.value = { x, y, width, height };
        if (active) onInteractiveReady(trayIndex, readyToken);
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [onInteractiveReady, piece, readyToken, slotMeasure, trayIndex]);

  const { gesture, animatedStyle } = useDrag({
    trayIndex,
    cells,
    w,
    h,
    colorId,
    disabled,
    ctx,
    slotMeasure,
    measureForDrag,
    committedOpacity: appearOpacity,
    restingScale,
    reducedMotion,
  });

  return (
    <View
      ref={containerRef}
      collapsable={false}
      onLayout={measureSlot}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      <GestureDetector
        key={disabled ? 'unavailable' : 'interactive'}
        gesture={gesture}
      >
        <Pressable
          testID={`tray-hit-${trayIndex}`}
          collapsable={false}
          accessible={disabled}
          accessibilityRole={disabled ? 'button' : undefined}
          accessibilityLabel={disabled ? ctx.unavailablePieceLabel : undefined}
          accessibilityState={disabled ? { disabled: true } : undefined}
          onAccessibilityTap={
            disabled ? () => ctx.onUnavailablePiecePress?.(shape.id) : undefined
          }
          onPress={
            disabled ? () => ctx.onUnavailablePiecePress?.(shape.id) : undefined
          }
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: TRAY_ACTIVATION.bottom,
            left: 0,
            overflow: 'visible',
          }}
        />
      </GestureDetector>
      <Animated.View
        pointerEvents="none"
        style={[{ width: figW, height: figH, flexShrink: 0 }, appearStyle]}
      >
        <Animated.View
          style={[
            {
              width: figW,
              height: figH,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
            },
            animatedStyle,
          ]}
        >
          <View style={{ width: figW, height: figH, position: 'relative' }}>
            <Animated.View testID={`helper-hint-piece-${trayIndex}`} pointerEvents="none"
              style={[{ position: 'absolute', inset: -9, borderRadius: 16, borderWidth: 4,
                borderColor: '#FFC93C', backgroundColor: 'rgba(255,201,60,0.1)',
                boxShadow: '0px 0px 16px rgba(255,201,60,0.55)' }, hintStyle]} />
            {(cells as readonly (readonly [number, number])[]).map(
              ([dr, dc], index) => (
                <View
                  key={index}
                  style={{
                    position: 'absolute',
                    left: dc * (cell + trayCellGap),
                    top: dr * (cell + trayCellGap),
                  }}
                >
                  <Block size={cell} color={color} />
                  {renderCellOverlay?.(index, cell)}
                </View>
              ),
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
