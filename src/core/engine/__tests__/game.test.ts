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
  it('пустая доска, 3 разные фигуры, цвета валидны', () => {
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

  it('детерминирован по seed', () => {
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

describe('place: базовое размещение', () => {
  it('кладёт фигуру, событие без очистки', () => {
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

  it('бросает на занятую клетку / пустой слот / законченную игру', () => {
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

describe('place: очистка и скоринг', () => {
  it('достройка строки: 93 очка, combo 1, praise good', () => {
    const board = emptyBoard();
    for (let c = 0; c < 5; c++) board[idx(3, c)] = 4;
    board[idx(6, 0)] = 5; // остаток, чтобы не сработал бонус пустой доски
    const s = baseState({ board });
    const { state, event } = place(s, 1, 3, 5); // h3 на (3,5..7)
    expect(event.clearedRows).toEqual([3]);
    expect(event.clearedCols).toEqual([]);
    expect(event.clearedCells.length).toBe(8);
    // цвета до очистки: 5 старых (color 4) + 3 от фигуры h3 (color 2)
    expect(event.clearedColors.filter((c) => c === 4).length).toBe(5);
    expect(event.clearedColors.filter((c) => c === 2).length).toBe(3);
    expect(event.scoreDelta).toBe(93);
    expect(event.combo).toBe(1);
    expect(event.praise).toBe('good');
    expect(event.onFire).toBe(false);
    // строка очищена
    for (let c = 0; c < 8; c++) expect(state.board[idx(3, c)]).toBe(0);
  });

  it('две строки разом: praise great, бонус 20', () => {
    const board = emptyBoard();
    for (const r of [0, 1]) for (let c = 0; c < 6; c++) board[idx(r, c)] = 2;
    board[idx(6, 0)] = 5; // остаток против бонуса пустой доски
    const s = baseState({ board });
    const { event } = place(s, 2, 0, 6); // sq2 на (0..1, 6..7)
    expect(event.clearedRows).toEqual([0, 1]);
    expect(event.clearedCells.length).toBe(16);
    expect(event.scoreDelta).toBe(4 + 180);
    expect(event.praise).toBe('great');
  });

  it('комбо растёт и даёт множитель, onFire с 3', () => {
    const board = emptyBoard();
    for (let c = 0; c < 5; c++) board[idx(3, c)] = 4;
    board[idx(6, 0)] = 5; // остаток против бонуса пустой доски
    const s = baseState({ board, combo: 2 });
    const { event } = place(s, 1, 3, 5);
    expect(event.combo).toBe(3);
    expect(event.onFire).toBe(true);
    expect(event.scoreDelta).toBe(3 + 180); // 90 × 2
  });

  it('ход без очистки сбрасывает комбо (forgiveness 0)', () => {
    const s = baseState({ combo: 2 });
    const { state, event } = place(s, 0, 4, 4);
    expect(state.combo).toBe(0);
    expect(event.combo).toBe(0);
  });

  it('полная очистка доски: +360', () => {
    const board = emptyBoard();
    for (let c = 0; c < 7; c++) board[idx(0, c)] = 3;
    const s = baseState({ board });
    const { event } = place(s, 0, 0, 7); // dot достраивает единственную строку
    expect(event.boardCleared).toBe(true);
    expect(event.scoreDelta).toBe(1 + 90 + 360);
  });
});

describe('place: волны и game over', () => {
  it('последняя фигура волны → перевыдача трея', () => {
    const s = baseState({ tray: [{ shape: dot, colorId: 1 }, null, null] });
    const { state, event } = place(s, 0, 0, 0);
    expect(event.newTray).toBe(true);
    expect(state.tray.filter(Boolean).length).toBe(3);
    expect(state.rngState).not.toBe(s.rngState);
  });

  it('game over, когда оставшиеся фигуры не влезают', () => {
    // Почти полная доска без единой полной линии: в каждой строке r пусты
    // (r, r) и (r, (r+1) % 8) — у каждой строки и каждого столбца по 2 дырки.
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
    // строка/столбец не должны были собраться
    expect(event.clearedCells).toEqual([]);
    expect(event.gameOver).toBe(true);
    expect(state.status).toBe('over');
  });

  it('revive: доска чистая, счёт сохранён, флаг взведён', () => {
    const s = baseState({ status: 'over', score: 500, combo: 4 });
    const r = revive(s);
    expect(r.status).toBe('playing');
    expect(r.board.every((v) => v === 0)).toBe(true);
    expect(r.score).toBe(500);
    expect(r.combo).toBe(4);
    expect(r.reviveUsed).toBe(true);
  });
});
