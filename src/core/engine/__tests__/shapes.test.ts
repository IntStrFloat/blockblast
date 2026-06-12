import { SHAPES } from '../shapes';
import type { Shape } from '../types';

function isConnected(shape: Shape): boolean {
  const key = (r: number, c: number) => `${r},${c}`;
  const set = new Set(shape.cells.map(([r, c]) => key(r, c)));
  const [start] = shape.cells;
  const queue = [start];
  const visited = new Set([key(start[0], start[1])]);
  while (queue.length) {
    const [r, c] = queue.pop()!;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = key(r + dr, c + dc);
      if (set.has(k) && !visited.has(k)) {
        visited.add(k);
        queue.push([r + dr, c + dc]);
      }
    }
  }
  return visited.size === shape.cells.length;
}

describe('каталог фигур', () => {
  it('содержит не меньше 35 форм', () => {
    expect(SHAPES.length).toBeGreaterThanOrEqual(35);
  });

  it('id уникальны', () => {
    const ids = SHAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('каждая форма корректна: bbox, без дублей клеток, связная, вес > 0', () => {
    for (const s of SHAPES) {
      expect(s.cells.length).toBeGreaterThan(0);
      const maxR = Math.max(...s.cells.map(([r]) => r));
      const maxC = Math.max(...s.cells.map(([, c]) => c));
      const minR = Math.min(...s.cells.map(([r]) => r));
      const minC = Math.min(...s.cells.map(([, c]) => c));
      expect(minR).toBe(0);
      expect(minC).toBe(0);
      expect(s.h).toBe(maxR + 1);
      expect(s.w).toBe(maxC + 1);
      const keys = new Set(s.cells.map(([r, c]) => `${r},${c}`));
      expect(keys.size).toBe(s.cells.length);
      expect(isConnected(s)).toBe(true);
      expect(s.weight).toBeGreaterThan(0);
    }
  });

  it('ключевые формы на месте', () => {
    const ids = new Set(SHAPES.map((s) => s.id));
    for (const id of [
      'dot',
      'h2', 'h3', 'h4', 'h5',
      'v2', 'v3', 'v4', 'v5',
      'sq2', 'sq3', 'rect2x3', 'rect3x2',
      'c3-0', 'c3-1', 'c3-2', 'c3-3',
      'L0', 'L1', 'L2', 'L3',
      'J0', 'J1', 'J2', 'J3',
      'T0', 'T1', 'T2', 'T3',
      'S0', 'S1', 'Z0', 'Z1',
      'c5-0', 'c5-1', 'c5-2', 'c5-3',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('фигуры влезают на доску 8x8', () => {
    for (const s of SHAPES) {
      expect(s.w).toBeLessThanOrEqual(8);
      expect(s.h).toBeLessThanOrEqual(8);
    }
  });
});
