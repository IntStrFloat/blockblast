import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue } from 'react-native-reanimated';

import { hasPlacement } from '@/core/engine';
import type { PieceInstance } from '@/core/engine';
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
  const containerRef = useRef<Animated.View>(null);

  const { gesture, animatedStyle } = useDrag({
    trayIndex,
    cells,
    w,
    h,
    colorId,
    disabled,
    ctx,
    slotMeasure,
  });

  // Полный размер фигуры при scale=1
  const figW = w * cell + (w > 1 ? (w - 1) * gap : 0);
  const figH = h * cell + (h > 1 ? (h - 1) * gap : 0);

  const onContainerLayout = useCallback(() => {
    // measureInWindow нельзя вызывать в worklet — снимаем на JS при layout
    containerRef.current?.measureInWindow((x, y, width, height) => {
      slotMeasure.value = { x, y, width, height };
    });
  }, [slotMeasure]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        ref={containerRef}
        onLayout={onContainerLayout}
        style={[
          {
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.35 : 1,
          },
          animatedStyle,
        ]}
      >
        {/* Фигура: сетка w×h клеток при полном размере (scale применяется через transform) */}
        <View
          style={{
            width: figW,
            height: figH,
            position: 'relative',
          }}
        >
          {(cells as ReadonlyArray<readonly [number, number]>).map(([dr, dc], i) => (
            <View
              key={i}
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
    </GestureDetector>
  );
}
