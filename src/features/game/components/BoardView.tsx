import { useCallback, useEffect, useRef, useState } from 'react';
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

  // Индексы только что размещённых клеток (для анимации scale)
  const [justPlacedSet, setJustPlacedSet] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => {
    if (!lastEvent || lastEvent.placed.length === 0) return;
    const indices = new Set(lastEvent.placed.map(([r, c]) => r * 8 + c));
    setJustPlacedSet(indices);
    // Сбрасываем через 150мс — чуть дольше анимации 120мс
    const timer = setTimeout(() => setJustPlacedSet(new Set()), 150);
    return () => clearTimeout(timer);
  }, [lastEvent]);

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
              justPlaced={justPlacedSet.has(index)}
            />
          );
        })}
        <ClearLayer />
        <Particles />
      </View>
    </Animated.View>
  );
}
