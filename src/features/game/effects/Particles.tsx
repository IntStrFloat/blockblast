import { useEffect, useRef, useState } from 'react';
import Animated, { Keyframe } from 'react-native-reanimated';

import { PARTICLE_MOTION, particleSourceIndexes } from '../animation/motion';
import { useDragCtx } from '../drag/DragContext';
import { useGameStore } from '../store';

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
 * Разлетающиеся квадратики при очистке: до 36 небольших фрагментов.
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

    const sourceIndexes = particleSourceIndexes(lastEvent.clearedCells.length);
    const next: Particle[] = [];
    sourceIndexes.forEach((sourceIndex, sourceOrder) => {
      const [r, c] = lastEvent.clearedCells[sourceIndex];
      const colorId = lastEvent.clearedColors[sourceIndex] ?? 1;
      const color = ctx.cellColors[colorId - 1] ?? '#FFFFFF';
      const cx = c * step + cell / 2;
      const cy = r * step + cell / 2;
      for (
        let fragment = 0;
        fragment < PARTICLE_MOTION.fragmentsPerSource &&
        next.length < PARTICLE_MOTION.maxParticles;
        fragment += 1
      ) {
        const angle = Math.random() * Math.PI * 2;
        const dist = cell * (1.4 + Math.random() * 1.8);
        next.push({
          id: `${gen}-${sourceOrder}-${fragment}`,
          x: cx,
          y: cy,
          size: Math.max(3, cell * (0.12 + Math.random() * 0.1)),
          color,
          dx: Math.cos(angle) * dist,
          dyUp: -Math.abs(Math.sin(angle)) * dist * 0.9 - cell * 0.45,
          dyDown: cell * (0.8 + Math.random()),
          rotate: `${Math.round((Math.random() - 0.5) * 320)}deg`,
        });
      }
    });
    setParts(next);

    const timer = setTimeout(() => {
      if (generation.current === gen) setParts([]);
    }, PARTICLE_MOTION.durationMs + 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  return (
    <>
      {parts.map((p) => {
        const kf = new Keyframe({
          0: {
            opacity: 1,
            transform: [
              { translateX: 0 },
              { translateY: 0 },
              { rotate: '0deg' },
              { scale: 1 },
            ],
          },
          55: {
            opacity: 1,
            transform: [
              { translateX: p.dx * 0.7 },
              { translateY: p.dyUp },
              { rotate: p.rotate },
              { scale: 0.9 },
            ],
          },
          100: {
            opacity: 0,
            transform: [
              { translateX: p.dx },
              { translateY: p.dyUp + p.dyDown },
              { rotate: p.rotate },
              { scale: 0.45 },
            ],
          },
        }).duration(PARTICLE_MOTION.durationMs);
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
