import { emptyBoard, idx, SHAPES_BY_ID } from '@/core/engine';
import type { PieceInstance } from '@/core/engine';

import {
  countTrayPlacements,
  findHintMove,
  findSwapTarget,
  isStuckish,
} from '../logic/helpers';

const dot = SHAPES_BY_ID.get('dot')!;
const sq3 = SHAPES_BY_ID.get('sq3')!;
const piece = (shape: typeof dot): PieceInstance => ({ shape, colorId: 1 });

describe('mascot helpers', () => {
  describe('findSwapTarget', () => {
    it('полная доска → первая непомещаемая фигура', () => {
      const full = emptyBoard().map(() => 1);
      expect(findSwapTarget(full, [piece(dot), piece(sq3), null])).toBe(0);
    });

    it('пустая доска → нет непомещаемых → null', () => {
      expect(findSwapTarget(emptyBoard(), [piece(dot), piece(sq3), null])).toBeNull();
    });
  });

  describe('findHintMove', () => {
    it('пустая доска → валидный ход для непустой фигуры', () => {
      const move = findHintMove(emptyBoard(), [null, piece(dot), null]);
      expect(move).not.toBeNull();
      expect(move!.trayIndex).toBe(1);
    });

    it('предпочитает ход, собирающий линию', () => {
      const board = emptyBoard();
      for (let c = 1; c < 8; c++) board[idx(0, c)] = 1; // строка 0 без (0,0)
      expect(findHintMove(board, [piece(dot)])).toEqual({ trayIndex: 0, r: 0, c: 0 });
    });

    it('ходов нет → null', () => {
      const full = emptyBoard().map(() => 1);
      expect(findHintMove(full, [piece(dot)])).toBeNull();
    });
  });

  describe('isStuckish', () => {
    it('пустая доска (много ходов) → false', () => {
      expect(isStuckish(emptyBoard(), [piece(dot), piece(sq3), null], 12)).toBe(false);
    });

    it('мало ходов (1 ≤ total ≤ threshold) → true', () => {
      const board = emptyBoard().map(() => 1);
      board[idx(0, 0)] = 0;
      board[idx(0, 1)] = 0;
      expect(countTrayPlacements(board, [piece(dot)])).toBe(2);
      expect(isStuckish(board, [piece(dot)], 12)).toBe(true);
    });

    it('ходов нет (total 0) → false', () => {
      const full = emptyBoard().map(() => 1);
      expect(isStuckish(full, [piece(dot)], 12)).toBe(false);
    });
  });
});
