import { BOARD_CELLS, BOARD_SIZE } from './types';
import type { Board, PieceInstance, Shape } from './types';

export function idx(r: number, c: number): number {
  return r * BOARD_SIZE + c;
}

export function emptyBoard(): Board {
  return new Array(BOARD_CELLS).fill(0);
}

export function canPlace(board: Board, shape: Shape, r: number, c: number): boolean {
  if (r < 0 || c < 0 || r + shape.h > BOARD_SIZE || c + shape.w > BOARD_SIZE) return false;
  for (const [dr, dc] of shape.cells) {
    if (board[idx(r + dr, c + dc)] !== 0) return false;
  }
  return true;
}

export function applyPlacement(
  board: Board,
  shape: Shape,
  r: number,
  c: number,
  colorId: number,
): { board: Board; cells: [number, number][] } {
  const next = board.slice();
  const cells: [number, number][] = [];
  for (const [dr, dc] of shape.cells) {
    next[idx(r + dr, c + dc)] = colorId;
    cells.push([r + dr, c + dc]);
  }
  return { board: next, cells };
}

export function findFullLines(board: Board): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[idx(r, c)] === 0) {
        full = false;
        break;
      }
    }
    if (full) rows.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[idx(r, c)] === 0) {
        full = false;
        break;
      }
    }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

export function clearLines(
  board: Board,
  rows: number[],
  cols: number[],
): { board: Board; clearedCells: [number, number][] } {
  const next = board.slice();
  const seen = new Set<number>();
  const clearedCells: [number, number][] = [];
  for (const r of rows) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const i = idx(r, c);
      if (!seen.has(i)) {
        seen.add(i);
        clearedCells.push([r, c]);
        next[i] = 0;
      }
    }
  }
  for (const c of cols) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      const i = idx(r, c);
      if (!seen.has(i)) {
        seen.add(i);
        clearedCells.push([r, c]);
        next[i] = 0;
      }
    }
  }
  return { board: next, clearedCells };
}

export function findPlacements(board: Board, shape: Shape): [number, number][] {
  const result: [number, number][] = [];
  for (let r = 0; r <= BOARD_SIZE - shape.h; r++) {
    for (let c = 0; c <= BOARD_SIZE - shape.w; c++) {
      if (canPlace(board, shape, r, c)) result.push([r, c]);
    }
  }
  return result;
}

export function hasPlacement(board: Board, shape: Shape): boolean {
  for (let r = 0; r <= BOARD_SIZE - shape.h; r++) {
    for (let c = 0; c <= BOARD_SIZE - shape.w; c++) {
      if (canPlace(board, shape, r, c)) return true;
    }
  }
  return false;
}

export function hasAnyMove(board: Board, tray: (PieceInstance | null)[]): boolean {
  return tray.some((p) => p !== null && hasPlacement(board, p.shape));
}

export function isBoardEmpty(board: Board): boolean {
  return board.every((v) => v === 0);
}
