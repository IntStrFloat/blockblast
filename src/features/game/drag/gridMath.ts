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

interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragTopLeftInput {
  slot: WindowRect;
  translationX: number;
  translationY: number;
  figureWidth: number;
  figureHeight: number;
  pieceLiftPx: number;
  previewGapPx: number;
}

export function dragTopLefts(input: DragTopLeftInput): {
  piece: { x: number; y: number };
  preview: { x: number; y: number };
} {
  'worklet';
  const piece = {
    x: input.slot.x + input.slot.width / 2 + input.translationX - input.figureWidth / 2,
    y:
      input.slot.y +
      input.slot.height / 2 +
      input.translationY -
      input.pieceLiftPx -
      input.figureHeight / 2,
  };
  return {
    piece,
    preview: {
      x: piece.x,
      y: piece.y - input.figureHeight - input.previewGapPx,
    },
  };
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

/** Маска превью показывает только клетки самой фигуры. */
export function previewMask(
  cells: readonly (readonly [number, number])[],
  r: number,
  c: number,
): number[] {
  'worklet';
  const mask = new Array<number>(64).fill(0);
  for (let i = 0; i < cells.length; i++) {
    const idx = (r + cells[i][0]) * 8 + (c + cells[i][1]);
    mask[idx] = 1;
  }
  return mask;
}

export const EMPTY_MASK: number[] = new Array(64).fill(0);
