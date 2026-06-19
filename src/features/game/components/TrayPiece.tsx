import { useCallback, useEffect, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { hasPlacement } from '@/core/engine';
import type { PieceInstance } from '@/core/engine';
import { TRAY_ACTIVATION, TRAY_MOTION, trayRestingScale } from '../animation/motion';
import { useDragCtx } from '../drag/DragContext';
import type { SlotMeasure } from '../drag/useDrag';
import { useDrag } from '../drag/useDrag';
import { useGameStore } from '../store';
import { Block } from './Block';

interface TrayPieceProps {
  piece: PieceInstance;
  trayIndex: number;
}

export function TrayPiece({ piece, trayIndex }: TrayPieceProps) {
  const ctx = useDragCtx();
  const { geom, cellColors } = ctx;
  const { cell, gap } = geom;

  const board = useGameStore((s) => s.game.board);
  const { shape, colorId } = piece;
  const { cells, w, h } = shape;

  const color = colorId > 0 && colorId <= cellColors.length ? cellColors[colorId - 1] : '#FFFFFF';

  // Определяем, влезает ли фигура хоть куда-нибудь
  const disabled = !hasPlacement(board, shape);

  // SharedValue для позиции слота (measureInWindow снимается заранее на JS)
  const slotMeasure = useSharedValue<SlotMeasure>({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<View>(null);
  const appearScale = useSharedValue<number>(TRAY_MOTION.appearFromScale);
  const appearOpacity = useSharedValue<number>(0.7);

  // Зависим от идентичности фигуры (новый PieceInstance на каждой выдаче), а не
  // от shape.id+colorId: иначе при рефилле слота такой же формой того же цвета
  // эффект не срабатывал и фигура оставалась невидимой (committedOpacity=0).
  useEffect(() => {
    appearScale.value = TRAY_MOTION.appearFromScale;
    appearOpacity.value = 0.7;
    appearScale.value = withTiming(1, { duration: TRAY_MOTION.appearDurationMs });
    appearOpacity.value = withTiming(1, { duration: TRAY_MOTION.appearDurationMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece]);

  const appearStyle = useAnimatedStyle(() => ({
    opacity: appearOpacity.value,
    transform: [{ scale: appearScale.value }],
  }));

  // Полный размер фигуры при scale=1
  const figW = w * cell + (w > 1 ? (w - 1) * gap : 0);
  const figH = h * cell + (h > 1 ? (h - 1) * gap : 0);

  // Масштаб в покое под ширину слота: TrayView = 100% экрана, paddingHorizontal 8,
  // три равных слота. Широкие фигуры ужимаются, чтобы не налезать на соседнюю.
  const { width: screenWidth } = useWindowDimensions();
  const slotWidth = (screenWidth - 16) / 3;
  const restingScale = trayRestingScale(figW, slotWidth);

  const measureSlot = useCallback(() => {
    // measureInWindow нельзя вызывать в worklet — снимаем на JS при layout
    containerRef.current?.measureInWindow((x, y, width, height) => {
      slotMeasure.value = { x, y, width, height };
    });
  }, [slotMeasure]);

  const measureForDrag = useCallback(() => {
    measureSlot();
    ctx.boardMeasureRef.current?.();
    // Свежее зеркало доски на старт drag: worklet проверяет позицию по нему, а не
    // по отстающему useEffect. Иначе под лагами тень ложится на занятые клетки и
    // дроп отклоняется движком (баги наслаивания на доске и пропажи фигуры).
    ctx.boardMirror.value = [...useGameStore.getState().game.board];
  }, [ctx.boardMeasureRef, ctx.boardMirror, measureSlot]);

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
  });

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={`tray-hit-${trayIndex}`}
        collapsable={false}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: TRAY_ACTIVATION.bottom,
          left: 0,
          overflow: 'visible',
        }}
      >
        <View
          ref={containerRef}
          collapsable={false}
          onLayout={measureSlot}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: -TRAY_ACTIVATION.bottom,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
          }}
        >
          <Animated.View style={appearStyle}>
            <Animated.View
              style={[
                {
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: disabled ? 0.35 : 1,
                },
                animatedStyle,
              ]}
            >
              <View
                style={{
                  width: figW,
                  height: figH,
                  position: 'relative',
                }}
              >
                {(cells as readonly (readonly [number, number])[]).map(([dr, dc], index) => (
                  <View
                    key={index}
                    style={{
                      position: 'absolute',
                      left: dc * (cell + gap),
                      top: dr * (cell + gap),
                    }}
                  >
                    <Block size={cell} color={color} />
                  </View>
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
}
