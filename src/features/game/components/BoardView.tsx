import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { radii } from '@/ui';
import { useDragCtx } from '../drag/DragContext';
import { ClearLayer } from '../effects/ClearLayer';
import { Particles } from '../effects/Particles';
import { useShake } from '../effects/useShake';
import { useGameStore } from '../store';
import { BoardCell } from './BoardCell';

interface BoardViewProps {
  style?: ViewStyle;
}

export function BoardView({ style }: BoardViewProps) {
  const ctx = useDragCtx();
  const { geom } = ctx;

  const board = useGameStore((s) => s.game.board);
  const lastEvent = useGameStore((s) => s.lastEvent);

  // Синхронизация boardMirror для worklet-проверок
  useEffect(() => {
    ctx.boardMirror.value = [...board];
  }, [board, ctx.boardMirror]);

  // Screen shake при очистке 2+ линий (спека 04)
  const { shakeStyle, triggerShake } = useShake();
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.clearedRows.length + lastEvent.clearedCols.length >= 2) {
      triggerShake();
    }
  }, [lastEvent, triggerShake]);

  // Запоминаем ref доски для measureInWindow
  const boardRef = useRef<View>(null);

  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y) => {
      ctx.boardOrigin.value = { x, y };
    });
  }, [ctx.boardOrigin]);

  const onLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      // setTimeout 0 гарантирует валидную позицию после layout-pass
      setTimeout(measureBoard, 0);
    },
    [measureBoard],
  );

  const { boardSize, cell, gap } = geom;
  const cellColors = ctx.cellColors;
  const { boardBg, cellEmpty } = ctx;

  return (
    <Animated.View style={shakeStyle}>
      <View
        ref={boardRef}
        onLayout={onLayout}
        style={[
          {
            width: boardSize,
            height: boardSize,
            borderRadius: radii.card / 2,
            overflow: 'hidden',
            backgroundColor: boardBg,
            position: 'relative',
          },
          style,
        ]}
      >
        {board.map((colorId, index) => {
          const fillColor =
            colorId > 0 && colorId <= cellColors.length ? cellColors[colorId - 1] : '';
          return (
            <BoardCell
              key={index}
              index={index}
              colorId={colorId}
              size={cell}
              gap={gap}
              fillColor={fillColor}
              emptyColor={cellEmpty}
            />
          );
        })}
        <ClearLayer />
        <Particles />
      </View>
    </Animated.View>
  );
}
