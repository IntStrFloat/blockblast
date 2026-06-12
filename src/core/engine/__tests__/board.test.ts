import {
  applyPlacement,
  canPlace,
  clearLines,
  emptyBoard,
  findFullLines,
  hasAnyMove,
  idx,
  isBoardEmpty,
} from '../board';
import { SHAPES_BY_ID } from '../shapes';
import type { Board, PieceInstance } from '../types';

const sq2 = SHAPES_BY_ID.get('sq2')!;
const h3 = SHAPES_BY_ID.get('h3')!;
const dot = SHAPES_BY_ID.get('dot')!;
const sq3 = SHAPES_BY_ID.get('sq3')!;

function boardWith(cells: [number, number][]): Board {
  const b = emptyBoard();
  for (const [r, c] of cells) b[idx(r, c)] = 1;
  return b;
}

describe('canPlace', () => {
  it('пустая доска: фигура встаёт в угол и в центр', () => {
    const b = emptyBoard();
    expect(canPlace(b, sq2, 0, 0)).toBe(true);
    expect(canPlace(b, sq2, 3, 3)).toBe(true);
    expect(canPlace(b, sq2, 6, 6)).toBe(true);
  });

  it('за границей — нельзя', () => {
    const b = emptyBoard();
    expect(canPlace(b, sq2, 7, 7)).toBe(false);
    expect(canPlace(b, sq2, -1, 0)).toBe(false);
    expect(canPlace(b, h3, 0, 6)).toBe(false);
    expect(canPlace(b, h3, 0, 5)).toBe(true);
  });

  it('пересечение с занятой клеткой — нельзя', () => {
    const b = boardWith([[1, 1]]);
    expect(canPlace(b, sq2, 0, 0)).toBe(false);
    expect(canPlace(b, sq2, 1, 1)).toBe(false);
    expect(canPlace(b, sq2, 2, 2)).toBe(true);
  });
});

describe('findFullLines', () => {
  it('полная строка', () => {
    const b = boardWith(Array.from({ length: 8 }, (_, c) => [3, c] as [number, number]));
    expect(findFullLines(b)).toEqual({ rows: [3], cols: [] });
  });

  it('полный столбец', () => {
    const b = boardWith(Array.from({ length: 8 }, (_, r) => [r, 5] as [number, number]));
    expect(findFullLines(b)).toEqual({ rows: [], cols: [5] });
  });

  it('строка и столбец одновременно', () => {
    const cells: [number, number][] = [];
    for (let c = 0; c < 8; c++) cells.push([2, c]);
    for (let r = 0; r < 8; r++) cells.push([r, 4]);
    const b = boardWith(cells);
    expect(findFullLines(b)).toEqual({ rows: [2], cols: [4] });
  });

  it('неполная линия не находится', () => {
    const b = boardWith(Array.from({ length: 7 }, (_, c) => [0, c] as [number, number]));
    expect(findFullLines(b)).toEqual({ rows: [], cols: [] });
  });
});

describe('clearLines', () => {
  it('очищает строку и столбец, пересечение считает один раз', () => {
    const cells: [number, number][] = [];
    for (let c = 0; c < 8; c++) cells.push([2, c]);
    for (let r = 0; r < 8; r++) if (r !== 2) cells.push([r, 4]);
    const b = boardWith(cells);
    const { board, clearedCells } = clearLines(b, [2], [4]);
    expect(clearedCells.length).toBe(15); // 8 + 8 - 1 пересечение
    expect(board.every((v) => v === 0)).toBe(true);
  });

  it('не трогает клетки вне линий', () => {
    const cells: [number, number][] = [[5, 5]];
    for (let c = 0; c < 8; c++) cells.push([0, c]);
    const b = boardWith(cells);
    const { board } = clearLines(b, [0], []);
    expect(board[idx(5, 5)]).toBe(1);
    expect(board[idx(0, 0)]).toBe(0);
  });
});

describe('applyPlacement', () => {
  it('записывает colorId в клетки фигуры', () => {
    const b = emptyBoard();
    const placed = applyPlacement(b, sq2, 1, 2, 4);
    expect(placed.board[idx(1, 2)]).toBe(4);
    expect(placed.board[idx(2, 3)]).toBe(4);
    expect(placed.cells).toEqual([
      [1, 2], [1, 3], [2, 2], [2, 3],
    ]);
    // исходная доска не мутирована
    expect(b[idx(1, 2)]).toBe(0);
  });
});

describe('hasAnyMove / isBoardEmpty', () => {
  it('пустая доска: ход есть', () => {
    const tray: (PieceInstance | null)[] = [{ shape: sq3, colorId: 1 }, null, null];
    expect(hasAnyMove(emptyBoard(), tray)).toBe(true);
  });

  it('забитая доска: хода нет', () => {
    const b = emptyBoard().map(() => 1);
    const tray: (PieceInstance | null)[] = [{ shape: dot, colorId: 1 }];
    expect(hasAnyMove(b, tray)).toBe(false);
  });

  it('3x3 не влезает в свободный уголок 2x2, а точка влезает', () => {
    const b = emptyBoard().map(() => 1);
    b[idx(0, 0)] = 0;
    b[idx(0, 1)] = 0;
    b[idx(1, 0)] = 0;
    b[idx(1, 1)] = 0;
    expect(hasAnyMove(b, [{ shape: sq3, colorId: 1 }])).toBe(false);
    expect(hasAnyMove(b, [{ shape: sq3, colorId: 1 }, { shape: dot, colorId: 2 }])).toBe(true);
  });

  it('isBoardEmpty', () => {
    expect(isBoardEmpty(emptyBoard())).toBe(true);
    expect(isBoardEmpty(boardWith([[0, 0]]))).toBe(false);
  });
});
