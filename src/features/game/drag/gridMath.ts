/**
 * Чистая математика drag-n-drop. Все функции worklet-безопасны:
 * вызываются на UI-потоке каждый кадр (спека 07 — ноль JS-моста в drag).
 */

export interface BoardGeom {
  /** Позиция доски в окне */
  boardX: number;
  boardY: number;
  /** Внутренний отступ доски до первой ячейки */
  pad: number;
  cell: number;
  gap: number;
}

/** Верхний левый угол фигуры (в координатах окна) → ближайшая ячейка сетки. */
export function topLeftToCell(
  tlX: number,
  tlY: number,
  g: BoardGeom,
): { r: number; c: number } {
  'worklet';
  const step = g.cell + g.gap;
  return {
    r: Math.round((tlY - g.boardY - g.pad) / step),
    c: Math.round((tlX - g.boardX - g.pad) / step),
  };
}

/** canPlace по зеркалу доски (плоский массив 64). */
export function fitsOnBoard(
  board: ArrayLike<number>,
  cells: readonly (readonly [number, number])[],
  r: number,
  c: number,
  w: number,
  h: number,
): boolean {
  'worklet';
  if (r < 0 || c < 0 || r + h > 8 || c + w > 8) return false;
  for (let i = 0; i < cells.length; i++) {
    if (board[(r + cells[i][0]) * 8 + (c + cells[i][1])] !== 0) return false;
  }
  return true;
}

/**
 * Маска превью 64: 0 — ничего, 1 — ghost-клетки фигуры,
 * 2 — клетки линий, которые соберутся этим ходом (подсветка).
 */
export function previewMask(
  board: ArrayLike<number>,
  cells: readonly (readonly [number, number])[],
  r: number,
  c: number,
): number[] {
  'worklet';
  const mask = new Array<number>(64).fill(0);
  const tmp = new Array<number>(64);
  for (let i = 0; i < 64; i++) tmp[i] = board[i];
  for (let i = 0; i < cells.length; i++) {
    const idx = (r + cells[i][0]) * 8 + (c + cells[i][1]);
    tmp[idx] = 1;
    mask[idx] = 1;
  }
  for (let row = 0; row < 8; row++) {
    let full = true;
    for (let col = 0; col < 8; col++) {
      if (tmp[row * 8 + col] === 0) {
        full = false;
        break;
      }
    }
    if (full) for (let col = 0; col < 8; col++) mask[row * 8 + col] = 2;
  }
  for (let col = 0; col < 8; col++) {
    let full = true;
    for (let row = 0; row < 8; row++) {
      if (tmp[row * 8 + col] === 0) {
        full = false;
        break;
      }
    }
    if (full) for (let row = 0; row < 8; row++) mask[row * 8 + col] = 2;
  }
  return mask;
}

export const EMPTY_MASK: number[] = new Array(64).fill(0);
