import {
  applyPlacement,
  clearLines,
  emptyBoard,
  findFullLines,
  findPlacements,
  hasAnyMove,
  hasPlacement,
  idx,
} from '../board';
import { DEFAULT_CONFIG } from '../config';
import { createGame, place, replaceTrayPiece, revive, trayMass } from '../game';
import { SHAPES_BY_ID } from '../shapes';
import type { Board, GameConfig, GameState, PieceInstance } from '../types';

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
    waveNumber: 0,
    status: 'playing',
    reviveUsed: false,
    rngState: 1,
    ...over,
  };
}

function canPlayEntireTray(
  board: Board,
  tray: readonly (PieceInstance | null)[],
): boolean {
  const remaining = tray.filter((piece): piece is PieceInstance => piece !== null);
  if (remaining.length === 0) return true;

  return remaining.some((piece, pieceIndex) =>
    findPlacements(board, piece.shape).some(([r, c]) => {
      const placed = applyPlacement(board, piece.shape, r, c, piece.colorId).board;
      const { rows, cols } = findFullLines(placed);
      const nextBoard =
        rows.length > 0 || cols.length > 0
          ? clearLines(placed, rows, cols).board
          : placed;
      const nextTray = remaining.filter((_, index) => index !== pieceIndex);
      return canPlayEntireTray(nextBoard, nextTray);
    }),
  );
}

describe('createGame', () => {
  it('starts with an empty board, 3 pieces, and valid colors', () => {
    const g = createGame(123);
    expect(g.board.every((v) => v === 0)).toBe(true);
    expect(g.tray.filter(Boolean).length).toBe(3);
    // Duplicate shapes are allowed (like the original), so no distinctness check.
    for (const p of g.tray) {
      expect(p!.colorId).toBeGreaterThanOrEqual(1);
      expect(p!.colorId).toBeLessThanOrEqual(6);
    }
    expect(g.score).toBe(0);
    expect(g.waveNumber).toBe(0);
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

describe('dynamic spawn director', () => {
  // S/Z are the "diagonal" tetrominoes; dot is the single. These should resurface
  // when the board is packed.
  const SMALL = new Set(['dot', 'S0', 'S1', 'Z0', 'Z1']);

  // 48 filled / 16 empty (2 gaps per row AND per column) ⇒ placing a dot never clears.
  function nearFullBoard(): Board {
    const b = emptyBoard().map(() => 1);
    for (let r = 0; r < 8; r += 1) {
      b[idx(r, r)] = 0;
      b[idx(r, (r + 1) % 8)] = 0;
    }
    return b;
  }

  // Place a dot into a gap of the near-full board (no line clears) → forces a fresh
  // tray to be dealt against a ~75%-full board.
  function dealtOnNearFull(rngState: number): PieceInstance[] {
    const s = baseState({
      board: nearFullBoard(),
      tray: [{ shape: dot, colorId: 1 }, null, null],
      rngState,
    });
    const { state, event } = place(s, 0, 0, 0);
    expect(event.newTray).toBe(true);
    return state.tray.filter((p): p is PieceInstance => p !== null);
  }

  const emptyTrays = () =>
    Array.from({ length: 60 }, (_, i) =>
      createGame(i + 1).tray.filter((p): p is PieceInstance => p !== null),
    );
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('deals big, high-mass trays on an empty board, far heavier than when packed', () => {
    const empty = emptyTrays().map(trayMass);
    const full: number[] = [];
    for (let seed = 1; seed <= 60; seed += 1) full.push(trayMass(dealtOnNearFull(seed)));
    // Empty board aims at a high mass target (big blocks); a packed board shifts small.
    expect(avg(empty)).toBeGreaterThanOrEqual(20);
    expect(avg(empty)).toBeGreaterThan(avg(full) + 2);
  });

  it('reliably opens with big blocks — most empty-board trays contain a 3×3', () => {
    const withSq3 = emptyTrays().filter((t) => t.some((p) => p.shape.id === 'sq3')).length;
    expect(withSq3).toBeGreaterThanOrEqual(40);
  });

  it('allows duplicate shapes in a tray (like the original)', () => {
    const anyDup = emptyTrays().some((t) => new Set(t.map((p) => p.shape.id)).size < t.length);
    expect(anyDup).toBe(true);
  });

  it('deals more small / diagonal pieces when the board is packed', () => {
    const countSmall = (pieces: PieceInstance[]) =>
      pieces.filter((p) => SMALL.has(p.shape.id)).length;
    let emptySmall = 0;
    let fullSmall = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      emptySmall += countSmall(createGame(seed).tray.filter((p): p is PieceInstance => p !== null));
      fullSmall += countSmall(dealtOnNearFull(seed));
    }
    expect(fullSmall).toBeGreaterThan(emptySmall);
  });
});

describe('trayMass', () => {
  it('sums the cell counts of every piece, ranking big trays above small ones', () => {
    const rect2x3 = SHAPES_BY_ID.get('rect2x3')!;
    const rect3x2 = SHAPES_BY_ID.get('rect3x2')!;
    const h2 = SHAPES_BY_ID.get('h2')!;
    const v2 = SHAPES_BY_ID.get('v2')!;

    const bigTray = [rect2x3, rect3x2, sq3].map((shape) => ({ shape, colorId: 1 }));
    const smallTray = [dot, h2, v2].map((shape) => ({ shape, colorId: 1 }));

    expect(trayMass(bigTray)).toBe(6 + 6 + 9);
    expect(trayMass(smallTray)).toBe(1 + 2 + 2);
    expect(trayMass(bigTray)).toBeGreaterThan(trayMass(smallTray));
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

  it('increments the wave number only after the last tray piece is placed', () => {
    const s = baseState({
      tray: [{ shape: dot, colorId: 1 }, null, null],
      waveNumber: 2,
    });

    const { state } = place(s, 0, 0, 0);

    expect(state.waveNumber).toBe(3);
  });

  it('deals only trays that can be played completely in some order', () => {
    const board = emptyBoard().map(() => 1);
    for (let r = 0; r < 8; r += 1) {
      board[idx(r, r)] = 0;
      board[idx(r, (r + 1) % 8)] = 0;
    }

    for (let seed = 1; seed <= 64; seed += 1) {
      const s = baseState({
        board,
        tray: [{ shape: dot, colorId: 1 }, null, null],
        rngState: seed,
      });
      const { state, event } = place(s, 0, 0, 0);

      expect(event.newTray).toBe(true);
      expect(state.status).toBe('playing');
      expect(canPlayEntireTray(state.board, state.tray)).toBe(true);
    }
  });

  it('bounds fallback tray search and ends the game only when the dealt tray truly has no move', () => {
    const board = emptyBoard().map(() => 1);
    for (let r = 0; r < 8; r += 1) {
      board[idx(r, r)] = 0;
      board[idx(r, (r + 1) % 8)] = 0;
    }
    const config: GameConfig = {
      ...DEFAULT_CONFIG,
      spawn: { ...DEFAULT_CONFIG.spawn, candidates: 0, fallbackNodeLimit: 1 },
    };

    for (let seed = 1; seed <= 32; seed += 1) {
      const s = baseState({
        board: board.slice(),
        tray: [{ shape: dot, colorId: 1 }, null, null],
        rngState: seed,
      });

      const { state, event } = place(s, 0, 0, 0, config);

      expect(event.newTray).toBe(true);
      expect(state.status === 'over').toBe(!hasAnyMove(state.board, state.tray));
    }
  });

  it('не завершает партию из-за исчерпания бюджета поиска, пока у выданного трея есть ход', () => {
    // Свободный блок 5×5 (rows 0..4 × cols 0..4) вмещает любую фигуру каталога;
    // остальное занято с диагональными дырами, чтобы не было полных линий.
    // candidates: 0 + fallbackNodeLimit: 1 гарантированно роняют выдачу в dead-ветку.
    const board = emptyBoard();
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        if ((r > 4 || c > 4) && !(r === c && r > 4)) board[idx(r, c)] = 1;
      }
    }
    const config: GameConfig = {
      ...DEFAULT_CONFIG,
      spawn: { ...DEFAULT_CONFIG.spawn, candidates: 0, fallbackNodeLimit: 1 },
    };

    for (let seed = 1; seed <= 16; seed += 1) {
      const s = baseState({
        board: board.slice(),
        tray: [{ shape: dot, colorId: 1 }, null, null],
        rngState: seed,
      });

      const { state, event } = place(s, 0, 0, 0, config);

      expect(event.newTray).toBe(true);
      expect(event.gameOver).toBe(false);
      expect(state.status).toBe('playing');
    }
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

describe('replaceTrayPiece', () => {
  it('меняет только целевой слот, другие слоты не затронуты', () => {
    const s = baseState({ rngState: 42 });
    const result = replaceTrayPiece(s, 1);
    // slot 0 and slot 2 are unchanged (referentially equal)
    expect(result.tray[0]).toBe(s.tray[0]);
    expect(result.tray[2]).toBe(s.tray[2]);
    // slot 1 was replaced
    expect(result.tray[1]).not.toBe(s.tray[1]);
    expect(result.tray[1]).not.toBeNull();
  });

  it('rngState изменяется после вызова', () => {
    const s = baseState({ rngState: 99 });
    const result = replaceTrayPiece(s, 0);
    expect(result.rngState).not.toBe(s.rngState);
  });

  it('детерминирован: одинаковый вход → одинаковый результат', () => {
    const s = baseState({ rngState: 7 });
    const r1 = replaceTrayPiece(s, 2);
    const r2 = replaceTrayPiece(s, 2);
    expect(r1.tray[2]).toEqual(r2.tray[2]);
    expect(r1.rngState).toBe(r2.rngState);
  });

  it('новый shape.id не совпадает ни с одним другим непустым слотом (exclude работает)', () => {
    // Use createGame so we have real shapes in all 3 slots
    const g = createGame(123);
    // Replace slot 0; the other slots (1, 2) stay, so the new shape must differ from both
    const result = replaceTrayPiece(g, 0);
    const newId = result.tray[0]!.shape.id;
    const otherId1 = result.tray[1]!.shape.id;
    const otherId2 = result.tray[2]!.shape.id;
    expect(newId).not.toBe(otherId1);
    expect(newId).not.toBe(otherId2);
  });

  it('board и score не меняются', () => {
    const board = emptyBoard();
    board[idx(0, 0)] = 3;
    const s = baseState({ board, score: 250, combo: 2, rngState: 55 });
    const result = replaceTrayPiece(s, 0);
    expect(result.board).toBe(s.board); // same reference — not mutated
    expect(result.score).toBe(250);
    expect(result.combo).toBe(2);
  });

  it('colorId валиден (в диапазоне 1..config.colors)', () => {
    const s = baseState({ rngState: 1337 });
    const result = replaceTrayPiece(s, 0);
    expect(result.tray[0]!.colorId).toBeGreaterThanOrEqual(1);
    expect(result.tray[0]!.colorId).toBeLessThanOrEqual(6);
  });

  it('работает когда целевой слот null', () => {
    const s = baseState({ tray: [null, { shape: dot, colorId: 1 }, { shape: h3, colorId: 2 }], rngState: 11 });
    const result = replaceTrayPiece(s, 0);
    expect(result.tray[0]).not.toBeNull();
    // exclude should exclude the shapes in slots 1 and 2
    expect(result.tray[0]!.shape.id).not.toBe(dot.id);
    expect(result.tray[0]!.shape.id).not.toBe(h3.id);
  });

  it('выдаёт замену, которая помещается на доску, когда такие фигуры есть', () => {
    // Почти полная доска (по два соседних пропуска на ряд): влезают только dot и h2.
    const board = emptyBoard().map(() => 1);
    for (let r = 0; r < 8; r += 1) {
      board[idx(r, r)] = 0;
      board[idx(r, (r + 1) % 8)] = 0;
    }

    for (let seed = 1; seed <= 40; seed += 1) {
      const s = baseState({ board: board.slice(), rngState: seed });
      const result = replaceTrayPiece(s, 1);
      expect(hasPlacement(board, result.tray[1]!.shape)).toBe(true);
    }
  });

  it('разрешает дубликат из другого слота, если влезает только он', () => {
    // Занято всё, кроме диагонали: помещается только dot, а dot уже лежит в слоте 0.
    const board = emptyBoard().map(() => 1);
    for (let r = 0; r < 8; r += 1) board[idx(r, r)] = 0;
    const s = baseState({ board, rngState: 5 });

    const result = replaceTrayPiece(s, 1);

    expect(result.tray[1]!.shape.id).toBe('dot');
    expect(result.status).toBe('playing');
  });

  it('честно завершает партию, если после замены ни одна фигура не помещается', () => {
    const board = emptyBoard().map(() => 1);
    const s = baseState({ board, rngState: 3 });

    const result = replaceTrayPiece(s, 0);

    expect(result.status).toBe('over');
    expect(result.tray).toEqual(s.tray);
  });
});
