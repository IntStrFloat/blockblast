import { fitsOnBoard, previewMask, topLeftToCell } from '../drag/gridMath';

const GEOM = { boardX: 100, boardY: 200, pad: 6, cell: 40, gap: 2 };

describe('topLeftToCell', () => {
  it('точное попадание в ячейку', () => {
    // ячейка (0,0) начинается в 106,206; (2,3): x=106+3*42=232, y=206+2*42=290
    expect(topLeftToCell(232, 290, GEOM)).toEqual({ r: 2, c: 3 });
  });

  it('округляет к ближайшей', () => {
    expect(topLeftToCell(232 + 15, 290 - 15, GEOM)).toEqual({ r: 2, c: 3 });
    expect(topLeftToCell(232 + 25, 290, GEOM)).toEqual({ r: 2, c: 4 });
  });

  it('за пределами — отрицательные/большие индексы (валидация отдельно)', () => {
    expect(topLeftToCell(0, 0, GEOM).r).toBeLessThan(0);
  });
});

describe('fitsOnBoard', () => {
  const empty = new Array(64).fill(0);
  const cells = [[0, 0], [0, 1], [1, 0], [1, 1]] as const; // sq2

  it('границы и пересечения', () => {
    expect(fitsOnBoard(empty, cells, 0, 0, 2, 2)).toBe(true);
    expect(fitsOnBoard(empty, cells, 6, 6, 2, 2)).toBe(true);
    expect(fitsOnBoard(empty, cells, 7, 7, 2, 2)).toBe(false);
    expect(fitsOnBoard(empty, cells, -1, 0, 2, 2)).toBe(false);
    const occupied = empty.slice();
    occupied[1 * 8 + 1] = 3;
    expect(fitsOnBoard(occupied, cells, 0, 0, 2, 2)).toBe(false);
    expect(fitsOnBoard(occupied, cells, 2, 2, 2, 2)).toBe(true);
  });
});

describe('previewMask', () => {
  it('ghost-клетки фигуры = 1', () => {
    const empty = new Array(64).fill(0);
    const mask = previewMask(empty, [[0, 0]], 3, 3);
    expect(mask[3 * 8 + 3]).toBe(1);
    expect(mask.filter((v) => v !== 0).length).toBe(1);
  });

  it('собирающаяся строка подсвечивается = 2', () => {
    const board = new Array(64).fill(0);
    for (let c = 0; c < 7; c++) board[2 * 8 + c] = 1; // строка 2 без последней
    const mask = previewMask(board, [[0, 0]], 2, 7);
    for (let c = 0; c < 8; c++) expect(mask[2 * 8 + c]).toBe(2);
    expect(mask.filter((v) => v === 2).length).toBe(8);
  });
});
