import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { radii } from '@/ui';

import { buildClearPresentation } from '../animation/clearPresentation';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useDragCtx } from '../drag/DragContext';
import { ClearLayer } from '../effects/ClearLayer';
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
  const reducedMotion = useReducedMotion();
  const presentation = useMemo(
    () =>
      lastEvent && lastEvent.clearedCells.length > 0
        ? buildClearPresentation(lastEvent, geom, ctx.cellColors, reducedMotion)
        : null,
    [ctx.cellColors, geom, lastEvent, reducedMotion],
  );

  // Синхронизация boardMirror для worklet-проверок
  useEffect(() => {
    ctx.boardMirror.value = [...board];
  }, [board, ctx.boardMirror]);

  // Screen shake при очистке 2+ линий (спека 04)
  const { shakeStyle, triggerShake } = useShake();
  useEffect(() => {
    if (presentation) triggerShake(presentation.shake);
  }, [presentation, triggerShake]);

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
        <ClearLayer
          key={lastEvent ? `${lastEvent.score}-${lastEvent.combo}` : 'clear-none'}
          presentation={presentation}
        />
      </View>
    </Animated.View>
  );
}
