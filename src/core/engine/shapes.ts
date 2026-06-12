import type { Shape } from './types';

/** Создаёт форму из ASCII-паттерна: 'X' — клетка, '.' — пусто. */
function shape(id: string, weight: number, pattern: string[]): Shape {
  const cells: [number, number][] = [];
  pattern.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === 'X') cells.push([r, c]);
    });
  });
  return {
    id,
    cells,
    w: Math.max(...pattern.map((p) => p.length)),
    h: pattern.length,
    weight,
  };
}

/**
 * Каталог по спеке 03: повороты — отдельные фигуры (вращения в игре нет).
 * Веса балансируют выдачу: реже всего гигантские и «неудобные» формы.
 */
export const SHAPES: Shape[] = [
  shape('dot', 0.5, ['X']),

  // Линии горизонтальные и вертикальные
  shape('h2', 1.0, ['XX']),
  shape('h3', 1.0, ['XXX']),
  shape('h4', 1.0, ['XXXX']),
  shape('h5', 0.6, ['XXXXX']),
  shape('v2', 1.0, ['X', 'X']),
  shape('v3', 1.0, ['X', 'X', 'X']),
  shape('v4', 1.0, ['X', 'X', 'X', 'X']),
  shape('v5', 0.6, ['X', 'X', 'X', 'X', 'X']),

  // Квадраты и прямоугольники
  shape('sq2', 1.0, ['XX', 'XX']),
  shape('sq3', 0.7, ['XXX', 'XXX', 'XXX']),
  shape('rect2x3', 0.9, ['XXX', 'XXX']),
  shape('rect3x2', 0.9, ['XX', 'XX', 'XX']),

  // Уголки из 3 клеток (4 ориентации)
  shape('c3-0', 1.0, ['XX', 'X.']),
  shape('c3-1', 1.0, ['XX', '.X']),
  shape('c3-2', 1.0, ['X.', 'XX']),
  shape('c3-3', 1.0, ['.X', 'XX']),

  // L-тетромино (4 ориентации)
  shape('L0', 0.8, ['X.', 'X.', 'XX']),
  shape('L1', 0.8, ['XXX', 'X..']),
  shape('L2', 0.8, ['XX', '.X', '.X']),
  shape('L3', 0.8, ['..X', 'XXX']),

  // J-тетромино (4 ориентации)
  shape('J0', 0.8, ['.X', '.X', 'XX']),
  shape('J1', 0.8, ['X..', 'XXX']),
  shape('J2', 0.8, ['XX', 'X.', 'X.']),
  shape('J3', 0.8, ['XXX', '..X']),

  // T-тетромино (4 ориентации)
  shape('T0', 0.8, ['XXX', '.X.']),
  shape('T1', 0.8, ['X.', 'XX', 'X.']),
  shape('T2', 0.8, ['.X.', 'XXX']),
  shape('T3', 0.8, ['.X', 'XX', '.X']),

  // S/Z-тетромино (по 2 ориентации)
  shape('S0', 0.7, ['.XX', 'XX.']),
  shape('S1', 0.7, ['X.', 'XX', '.X']),
  shape('Z0', 0.7, ['XX.', '.XX']),
  shape('Z1', 0.7, ['.X', 'XX', 'X.']),

  // Большие уголки 3×3 из 5 клеток (4 ориентации)
  shape('c5-0', 0.8, ['XXX', 'X..', 'X..']),
  shape('c5-1', 0.8, ['XXX', '..X', '..X']),
  shape('c5-2', 0.8, ['X..', 'X..', 'XXX']),
  shape('c5-3', 0.8, ['..X', '..X', 'XXX']),
];

export const SHAPES_BY_ID: ReadonlyMap<string, Shape> = new Map(
  SHAPES.map((s) => [s.id, s]),
);

export const TOTAL_WEIGHT = SHAPES.reduce((sum, s) => sum + s.weight, 0);
