import { useEffect, useRef, useState } from 'react';
import Animated, { Keyframe } from 'react-native-reanimated';

import { radii } from '@/ui';

import { useDragCtx } from '../drag/DragContext';
import { useGameStore } from '../store';

interface DyingCell {
  id: string;
  x: number;
  y: number;
  color: string;
  delay: number;
}

/**
 * Анимация очистки: копии очищенных клеток scale→0 + fade 250мс,
 * стаггер 18мс волной от точки размещения (спека 04).
 * Рендерится внутри контейнера доски (локальные координаты).
 */
export function ClearLayer() {
  const ctx = useDragCtx();
  const lastEvent = useGameStore((s) => s.lastEvent);
  const [cells, setCells] = useState<DyingCell[]>([]);
  const generation = useRef(0);

  useEffect(() => {
    if (!lastEvent || lastEvent.clearedCells.length === 0) return;
    const { cell, gap } = ctx.geom;
    const step = cell + gap;
    const placed = lastEvent.placed;
    const pr = placed.reduce((a, [r]) => a + r, 0) / Math.max(placed.length, 1);
    const pc = placed.reduce((a, [, c]) => a + c, 0) / Math.max(placed.length, 1);
    const gen = ++generation.current;

    let maxDelay = 0;
    const dying = lastEvent.clearedCells.map(([r, c], i) => {
      const colorId = lastEvent.clearedColors[i] ?? 1;
      const delay = Math.round((Math.abs(r - pr) + Math.abs(c - pc)) * 18);
      maxDelay = Math.max(maxDelay, delay);
      return {
        id: `${gen}-${i}`,
        x: c * step,
        y: r * step,
        color: ctx.cellColors[colorId - 1] ?? '#FFFFFF',
        delay,
      };
    });
    setCells(dying);

    const timer = setTimeout(() => {
      // Не затираем более свежую волну
      if (generation.current === gen) setCells([]);
    }, 250 + maxDelay + 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  const { cell } = ctx.geom;

  return (
    <>
      {cells.map((d) => {
        const kf = new Keyframe({
          0: { opacity: 1, transform: [{ scale: 1 }] },
          100: { opacity: 0, transform: [{ scale: 0 }] },
        })
          .duration(250)
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
