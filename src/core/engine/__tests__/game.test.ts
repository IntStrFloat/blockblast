import { emptyBoard, idx } from '../board';
import { createGame, place, revive } from '../game';
import { SHAPES_BY_ID } from '../shapes';
import type { GameState } from '../types';

const dot = SHAPES_BY_ID.get('dot')!;
const h3 = SHAPES_BY_ID.get('h3')!;
const sq2 = SHAPES_BY_ID.get('sq2')!;
const sq3 = SHAPES_BY_ID.get('sq3')!;

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    board: emptyBoard(),
    tray: [
      { shape: dot, colorId: 1 },
      { shape: h3, colorId: 2 },
      { shape: sq2, colorId: 3 },
    ],
    score: 0,
    combo: 0,
    movesSinceClear: 0,
    status: 'playing',
    reviveUsed: false,
    rngState: 1,
    ...over,
  };
}

describe('createGame', () => {
  it('starts with an empty board, 3 distinct shapes, and valid colors', () => {
    const g = createGame(123);
    expect(g.board.every((v) => v === 0)).toBe(true);
    expect(g.tray.filter(Boolean).length).toBe(3);
    const ids = g.tray.map((p) => p!.shape.id);
    expect(new Set(ids).size).toBe(3);
    for (const p of g.tray) {
      expect(p!.colorId).toBeGreaterThanOrEqual(1);
      expect(p!.colorId).toBeLessThanOrEqual(6);
    }
    expect(g.score).toBe(0);
    expect(g.status).toBe('playing');
  });

  it('is deterministic by seed', () => {
    const a = createGame(42);
    const b = createGame(42);
    expect(a.tray.map((p) => `${p!.shape.id}:${p!.colorId}`)).toEqual(
      b.tray.map((p) => `${p!.shape.id}:${p!.colorId}`),
    );
    expect(a.rngState).toBe(b.rngState);
    const c = createGame(43);
    expect(
      a.tray.map((p) => p!.shape.id).join() !== c.tray.map((p) => p!.shape.id).join() ||
        a.rngState !== c.rngState,
    ).toBe(true);
  });
});

describe('place: basic placement', () => {
  it('places a piece and emits a no-clear event', () => {
    const s = baseState();
    const { state, event } = place(s, 0, 4, 4);
    expect(state.board[idx(4, 4)]).toBe(1);
    expect(event.placed).toEqual([[4, 4]]);
    expect(event.scoreDelta).toBe(1);
    expect(event.praise).toBe('none');
    expect(event.clearedCells).toEqual([]);
    expect(event.newTray).toBe(false);
    expect(state.tray[0]).toBeNull();
  });

  it('throws on occupied cells, empty tray slots, and finished games', () => {
    const s = baseState();
    const occupied = { ...s, board: s.board.slice() };
    occupied.board[idx(0, 0)] = 5;
    expect(() => place(occupied, 0, 0, 0)).toThrow();
    const emptySlot = baseState({ tray: [null, { shape: dot, colorId: 1 }, null] });
    expect(() => place(emptySlot, 0, 0, 0)).toThrow();
    const over = baseState({ status: 'over' });
    expect(() => place(over, 0, 0, 0)).toThrow();
  });
});

describe('place: clears and scoring', () => {
  it('completes a row for 93 points, combo 1, praise good', () => {
    const board = emptyBoard();
    for (let c = 0; c < 5; c++) board[idx(3, c)] = 4;
    board[idx(6, 0)] = 5;
    const s = baseState({ board });
    const { state, event } = place(s, 1, 3, 5);
    expect(event.clearedRows).toEqual([3]);
    expect(event.clearedCols).toEqual([]);
    expect(event.clearedCells.length).toBe(8);
    expect(event.clearedColors.filter((c) => c === 4).length).toBe(5);
    expect(event.clearedColors.filter((c) => c === 2).length).toBe(3);
    expect(event.scoreDelta).toBe(93);
    expect(event.combo).toBe(1);
    expect(event.praise).toBe('good');
    expect(event.onFire).toBe(false);
    for (let c = 0; c < 8; c++) expect(state.board[idx(3, c)]).toBe(0);
  });

  it('clears two rows at once with great praise and +20 line bonus', () => {
    const board = emptyBoard();
    for (const r of [0, 1]) for (let c = 0; c < 6; c++) board[idx(r, c)] = 2;
    board[idx(6, 0)] = 5;
    const s = baseState({ board });
    const { event } = place(s, 2, 0, 6);
    expect(event.clearedRows).toEqual([0, 1]);
    expect(event.clearedCells.length).toBe(16);
    expect(event.scoreDelta).toBe(4 + 180);
    expect(event.praise).toBe('great');
  });

  it('increments combo, applies multiplier, and sets onFire from combo 3', () => {
    const board = emptyBoard();
    for (let c = 0; c < 5; c++) board[idx(3, c)] = 4;
    board[idx(6, 0)] = 5;
    const s = baseState({ board, combo: 2 });
    const { event } = place(s, 1, 3, 5);
    expect(event.combo).toBe(3);
    expect(event.onFire).toBe(true);
    expect(event.scoreDelta).toBe(3 + 180);
  });

  it('resets combo after a no-clear move when forgiveness is 0', () => {
    const s = baseState({ combo: 2 });
    const { state, event } = place(s, 0, 4, 4);
    expect(state.combo).toBe(0);
    expect(event.combo).toBe(0);
  });

  it('awards the board-clear bonus for an empty board after a move', () => {
    const board = emptyBoard();
    for (let c = 0; c < 7; c++) board[idx(0, c)] = 3;
    const s = baseState({ board });
    const { event } = place(s, 0, 0, 7);
    expect(event.boardCleared).toBe(true);
    expect(event.scoreDelta).toBe(1 + 90 + 360);
  });
});

describe('place: tray refresh and game over', () => {
  it('deals a new tray after the last piece of a wave is placed', () => {
    const s = baseState({ tray: [{ shape: dot, colorId: 1 }, null, null] });
    const { state, event } = place(s, 0, 0, 0);
    expect(event.newTray).toBe(true);
    expect(state.tray.filter(Boolean).length).toBe(3);
    expect(state.rngState).not.toBe(s.rngState);
  });

  it('ends the game when the remaining pieces have no legal placements', () => {
    const board = emptyBoard().map(() => 1);
    for (let r = 0; r < 8; r++) {
      board[idx(r, r)] = 0;
      board[idx(r, (r + 1) % 8)] = 0;
    }
    const s = baseState({
      board,
      tray: [{ shape: dot, colorId: 1 }, { shape: sq3, colorId: 2 }, null],
    });
    const { state, event } = place(s, 0, 0, 0);
    expect(event.clearedCells).toEqual([]);
    expect(event.gameOver).toBe(true);
    expect(state.status).toBe('over');
  });

  it('revive succeeds only from terminal unused state and resets continuation counters', () => {
    const board = emptyBoard();
    board[idx(0, 0)] = 4;
    board[idx(7, 7)] = 2;
    const s = baseState({
      board,
      tray: [null, { shape: h3, colorId: 6 }, { shape: sq2, colorId: 2 }],
      score: 500,
      combo: 4,
      movesSinceClear: 3,
      status: 'over',
      reviveUsed: false,
      rngState: 12345,
    });

    const r = revive(s);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('playing');
    expect(r!.board.every((v) => v === 0)).toBe(true);
    expect(r!.score).toBe(500);
    expect(r!.tray).toEqual(s.tray);
    expect(r!.combo).toBe(0);
    expect(r!.movesSinceClear).toBe(0);
    expect(r!.reviveUsed).toBe(true);
    expect(r!.rngState).toBe(12345);
  });

  it('revive rejects active, already-used, and repeated attempts explicitly', () => {
    expect(revive(baseState())).toBeNull();
    expect(revive(baseState({ status: 'over', reviveUsed: true }))).toBeNull();

    const revived = revive(baseState({ status: 'over' }));
    expect(revived).not.toBeNull();
    expect(revive(revived!)).toBeNull();
  });
});
