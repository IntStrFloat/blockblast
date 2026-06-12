import { useEffect, useRef, useState } from 'react';
import Animated, { Keyframe } from 'react-native-reanimated';

import { useDragCtx } from '../drag/DragContext';
import { useGameStore } from '../store';

const MAX_PARTICLES = 24;

interface Particle {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  dx: number;
  dyUp: number;
  dyDown: number;
  rotate: string;
}

/**
 * Разлетающиеся квадратики при очистке (450мс, до 24 штук — спека 04/07).
 * Внутри контейнера доски.
 */
export function Particles() {
  const ctx = useDragCtx();
  const lastEvent = useGameStore((s) => s.lastEvent);
  const [parts, setParts] = useState<Particle[]>([]);
  const generation = useRef(0);

  useEffect(() => {
    if (!lastEvent || lastEvent.clearedCells.length === 0) return;
    const { cell, gap } = ctx.geom;
    const step = cell + gap;
    const gen = ++generation.current;

    // Сэмплируем источники: не больше 12 клеток, по 2 частицы
    const sources = lastEvent.clearedCells.filter(
      (_, i) => i % Math.max(1, Math.ceil(lastEvent.clearedCells.length / 12)) === 0,
    );
    const next: Particle[] = [];
    sources.forEach(([r, c], i) => {
      const colorId = lastEvent.clearedColors[lastEvent.clearedCells.indexOf(sources[i])] ?? 1;
      const color = ctx.cellColors[colorId - 1] ?? '#FFFFFF';
      const cx = c * step + cell / 2;
      const cy = r * step + cell / 2;
      for (let k = 0; k < 2 && next.length < MAX_PARTICLES; k++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = cell * (1.2 + Math.random() * 1.6);
        next.push({
          id: `${gen}-${i}-${k}`,
          x: cx,
          y: cy,
          size: Math.max(4, cell * (0.16 + Math.random() * 0.12)),
          color,
          dx: Math.cos(angle) * dist,
          dyUp: -Math.abs(Math.sin(angle)) * dist * 0.8 - cell * 0.4,
          dyDown: cell * (0.8 + Math.random()),
          rotate: `${Math.round((Math.random() - 0.5) * 240)}deg`,
        });
      }
    });
    setParts(next);

    const timer = setTimeout(() => {
      if (generation.current === gen) setParts([]);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  return (
    <>
      {parts.map((p) => {
        const kf = new Keyframe({
          0: {
            opacity: 1,
            transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }],
          },
          60: {
            opacity: 1,
            transform: [
              { translateX: p.dx * 0.7 },
              { translateY: p.dyUp },
              { rotate: p.rotate },
            ],
          },
          100: {
            opacity: 0,
            transform: [
              { translateX: p.dx },
              { translateY: p.dyUp + p.dyDown },
              { rotate: p.rotate },
            ],
          },
        }).duration(450);
        return (
          <Animated.View
            key={p.id}
            entering={kf}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: p.x - p.size / 2,
              top: p.y - p.size / 2,
              width: p.size,
              height: p.size,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity: 0,
            }}
          />
        );
      })}
    </>
  );
}
