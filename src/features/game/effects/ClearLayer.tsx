import { useEffect, useRef, useState } from 'react';
import Animated, { Keyframe } from 'react-native-reanimated';

import { radii } from '@/ui';

import { CLEAR_MOTION, clearCellDelay } from '../animation/motion';
import { useDragCtx } from '../drag/DragContext';
import { useGameStore } from '../store';

interface DyingCell {
  id: string;
  x: number;
  y: number;
  color: string;
  delay: number;
  rotation: string;
}

interface LineFlash {
  id: string;
  orientation: 'row' | 'col';
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
}

/**
 * Анимация очистки: короткая вспышка линии, затем pop и распад клеток
 * плотной волной от точки размещения.
 * Рендерится внутри контейнера доски (локальные координаты).
 */
export function ClearLayer() {
  const ctx = useDragCtx();
  const lastEvent = useGameStore((s) => s.lastEvent);
  const [cells, setCells] = useState<DyingCell[]>([]);
  const [flashes, setFlashes] = useState<LineFlash[]>([]);
  const generation = useRef(0);

  useEffect(() => {
    if (!lastEvent || lastEvent.clearedCells.length === 0) return;
    const { cell, gap } = ctx.geom;
    const step = cell + gap;
    const placed = lastEvent.placed as readonly (readonly [number, number])[];
    const gen = ++generation.current;

    let maxDelay = 0;
    const dying = lastEvent.clearedCells.map(([r, c], i) => {
      const colorId = lastEvent.clearedColors[i] ?? 1;
      const delay = clearCellDelay([r, c], placed);
      maxDelay = Math.max(maxDelay, delay);
      return {
        id: `${gen}-${i}`,
        x: c * step,
        y: r * step,
        color: ctx.cellColors[colorId - 1] ?? '#FFFFFF',
        delay,
        rotation: `${(r + c) % 2 === 0 ? -14 : 14}deg`,
      };
    });
    const flashesNext: LineFlash[] = [
      ...lastEvent.clearedRows.map((row, index) => ({
        id: `${gen}-row-${row}`,
        orientation: 'row' as const,
        x: 0,
        y: row * step,
        width: ctx.geom.boardSize,
        height: cell,
        delay: index * 18,
      })),
      ...lastEvent.clearedCols.map((col, index) => ({
        id: `${gen}-col-${col}`,
        orientation: 'col' as const,
        x: col * step,
        y: 0,
        width: cell,
        height: ctx.geom.boardSize,
        delay: index * 18,
      })),
    ];
    setCells(dying);
    setFlashes(flashesNext);

    const timer = setTimeout(() => {
      // Не затираем более свежую волну
      if (generation.current === gen) {
        setCells([]);
        setFlashes([]);
      }
    }, Math.max(CLEAR_MOTION.flashDurationMs, CLEAR_MOTION.durationMs + maxDelay) + 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  const { cell } = ctx.geom;

  return (
    <>
      {flashes.map((flash) => {
        const frames =
          flash.orientation === 'row'
            ? {
                0: { opacity: 0, transform: [{ scaleX: 0.12 }] },
                28: { opacity: 0.7, transform: [{ scaleX: 1 }] },
                100: { opacity: 0, transform: [{ scaleX: 1.08 }] },
              }
            : {
                0: { opacity: 0, transform: [{ scaleY: 0.12 }] },
                28: { opacity: 0.7, transform: [{ scaleY: 1 }] },
                100: { opacity: 0, transform: [{ scaleY: 1.08 }] },
              };
        const kf = new Keyframe(frames)
          .duration(CLEAR_MOTION.flashDurationMs)
          .delay(flash.delay);
        return (
          <Animated.View
            key={flash.id}
            entering={kf}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: flash.x,
              top: flash.y,
              width: flash.width,
              height: flash.height,
              borderRadius: radii.cell,
              backgroundColor: 'rgba(255,255,255,0.48)',
              opacity: 0,
            }}
          />
        );
      })}
      {cells.map((d) => {
        const kf = new Keyframe({
          0: {
            opacity: 1,
            transform: [{ scale: 1 }, { rotate: '0deg' }],
          },
          28: {
            opacity: 1,
            transform: [{ scale: CLEAR_MOTION.popScale }, { rotate: '0deg' }],
          },
          100: {
            opacity: 0,
            transform: [{ scale: CLEAR_MOTION.collapseScale }, { rotate: d.rotation }],
          },
        })
          .duration(CLEAR_MOTION.durationMs)
          .delay(d.delay);
        return (
          <Animated.View
            key={d.id}
            entering={kf}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: d.x,
              top: d.y,
              width: cell,
              height: cell,
              borderRadius: radii.cell,
              backgroundColor: d.color,
              opacity: 0,
            }}
          />
        );
      })}
    </>
  );
}
