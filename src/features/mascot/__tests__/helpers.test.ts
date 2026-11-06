import { createGame, emptyBoard, idx, place, SHAPES_BY_ID } from '@/core/engine';
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
const hintGame = (board: number[], tray: (PieceInstance | null)[]) => ({
  ...createGame(42), board, tray,
});

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
      const move = findHintMove(hintGame(emptyBoard(), [null, piece(dot), null]));
      expect(move).not.toBeNull();
      expect(move!.trayIndex).toBe(1);
    });

    it('предпочитает ход, собирающий линию', () => {
      const board = emptyBoard();
      for (let c = 1; c < 8; c++) board[idx(0, c)] = 1; // строка 0 без (0,0)
      expect(findHintMove(hintGame(board, [piece(dot), null, null]))).toEqual({ trayIndex: 0, r: 0, c: 0 });
    });

    it('does not recommend the only legal move if it leaves the long bar blocked', () => {
      const board = [
        '10000111', '11111011', '00100011', '10100001',
        '10011110', '11100011', '11100001', '01100101',
      ].flatMap((row) => [...row].map(Number));
      const game = hintGame(board, [
        piece(SHAPES_BY_ID.get('h5')!), piece(SHAPES_BY_ID.get('rect3x2')!), null,
      ]);

      expect(place(game, 1, 5, 3).state.status).toBe('over');
      expect(findHintMove(game)).toBeNull();
    });

    it('keeps a path through the tray when the first legal placement blocks it', () => {
      const board = new Array<number>(64).fill(1);
      for (let r = 0; r < 8; r++) {
        board[idx(r, r)] = 0;
        board[idx(r, (r + 1) % 8)] = 0;
      }
      board.fill(0, 0, 5);
      const game = hintGame(board, [piece(dot), piece(SHAPES_BY_ID.get('h5')!), null]);
      expect(place(game, 0, 0, 0).state.status).toBe('over');

      const first = findHintMove(game)!;
      const next = place(game, first.trayIndex, first.r, first.c).state;
      const second = findHintMove(next)!;
      const result = place(next, second.trayIndex, second.r, second.c);
      expect(result.event.newTray).toBe(true);
      expect(result.state.status).toBe('playing');
    });

    it('ходов нет → null', () => {
      const full = emptyBoard().map(() => 1);
      expect(findHintMove(hintGame(full, [piece(dot), null, null]))).toBeNull();
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
