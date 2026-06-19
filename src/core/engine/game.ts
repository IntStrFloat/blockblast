import {
  applyPlacement,
  canPlace,
  clearLines,
  emptyBoard,
  findPlacements,
  findFullLines,
  hasAnyMove,
  idx,
  isBoardEmpty,
} from './board';
import { DEFAULT_CONFIG } from './config';
import { rngInt, rngNext, seedFromTime } from './rng';
import { SHAPES } from './shapes';
import { praiseFor, scorePlacement } from './scoring';
import { TRAY_SIZE } from './types';
import type {
  Board,
  GameConfig,
  GameState,
  PieceInstance,
  PlacementEvent,
  Shape,
} from './types';

function pickWeighted(
  state: number,
  exclude: ReadonlySet<string>,
): { shape: Shape; state: number } {
  const pool = SHAPES.filter((s) => !exclude.has(s.id));
  const total = pool.reduce((sum, s) => sum + s.weight, 0);
  const r = rngNext(state);
  const target = r.value * total;
  let acc = 0;
  for (const s of pool) {
    acc += s.weight;
    if (target < acc) return { shape: s, state: r.state };
  }
  return { shape: pool[pool.length - 1], state: r.state };
}

function makeRandomWave(
  rngState: number,
  colors: number,
): { tray: PieceInstance[]; rngState: number } {
  const exclude = new Set<string>();
  const tray: PieceInstance[] = [];
  let s = rngState;
  for (let i = 0; i < TRAY_SIZE; i++) {
    const picked = pickWeighted(s, exclude);
    exclude.add(picked.shape.id);
    s = picked.state;
    const color = rngInt(s, colors);
    s = color.state;
    tray.push({ shape: picked.shape, colorId: color.value + 1 });
  }
  return { tray, rngState: s };
}

function boardAfterPlacement(
  board: Board,
  shape: Shape,
  r: number,
  c: number,
): Board {
  const placed = applyPlacement(board, shape, r, c, 1).board;
  const { rows, cols } = findFullLines(placed);
  return rows.length > 0 || cols.length > 0
    ? clearLines(placed, rows, cols).board
    : placed;
}

function canPlayEntireTray(
  board: Board,
  tray: readonly PieceInstance[],
): boolean {
  const search = (
    currentBoard: Board,
    remaining: readonly PieceInstance[],
  ): boolean => {
    if (remaining.length === 0) return true;

    return remaining.some((piece, pieceIndex) =>
      findPlacements(currentBoard, piece.shape).some(([r, c]) =>
        search(
          boardAfterPlacement(currentBoard, piece.shape, r, c),
          remaining.filter((_, index) => index !== pieceIndex),
        ),
      ),
    );
  };

  return search(board, tray);
}

function weightedShapeOrder(
  rngState: number,
): { shapes: Shape[]; rngState: number } {
  const shapes: Shape[] = [];
  const exclude = new Set<string>();
  let s = rngState;

  while (shapes.length < SHAPES.length) {
    const picked = pickWeighted(s, exclude);
    shapes.push(picked.shape);
    exclude.add(picked.shape.id);
    s = picked.state;
  }

  return { shapes, rngState: s };
}

function findPlayableShapeSequence(
  board: Board,
  shapeOrder: readonly Shape[],
  allowDuplicates: boolean,
): Shape[] | null {
  const failed = new Set<string>();

  const search = (
    currentBoard: Board,
    selected: readonly Shape[],
    used: ReadonlySet<string>,
  ): Shape[] | null => {
    if (selected.length === TRAY_SIZE) return selected.slice();

    const occupied = currentBoard.map((cell) => (cell === 0 ? '0' : '1')).join('');
    const usedKey = allowDuplicates ? '' : [...used].sort().join(',');
    const memoKey = `${selected.length}:${usedKey}:${occupied}`;
    if (failed.has(memoKey)) return null;

    for (const shape of shapeOrder) {
      if (!allowDuplicates && used.has(shape.id)) continue;

      for (const [r, c] of findPlacements(currentBoard, shape)) {
        const nextUsed = allowDuplicates
          ? used
          : new Set([...used, shape.id]);
        const result = search(
          boardAfterPlacement(currentBoard, shape, r, c),
          [...selected, shape],
          nextUsed,
        );
        if (result) return result;
      }
    }

    failed.add(memoKey);
    return null;
  };

  return search(board, [], new Set<string>());
}

function makeWave(
  board: Board,
  rngState: number,
  colors: number,
): { tray: PieceInstance[]; rngState: number; playable: boolean } {
  const randomWave = makeRandomWave(rngState, colors);
  if (canPlayEntireTray(board, randomWave.tray)) {
    return { ...randomWave, playable: true };
  }

  // Keep normal weighted randomness; search only when that deal is unwinnable.
  const ordered = weightedShapeOrder(randomWave.rngState);
  const shapes =
    findPlayableShapeSequence(board, ordered.shapes, false) ??
    findPlayableShapeSequence(board, ordered.shapes, true);

  if (!shapes) {
    return { ...randomWave, rngState: ordered.rngState, playable: false };
  }

  let s = ordered.rngState;
  const tray = shapes.map((shape) => {
    const color = rngInt(s, colors);
    s = color.state;
    return { shape, colorId: color.value + 1 };
  });
  return { tray, rngState: s, playable: true };
}

export function createGame(
  seed: number = seedFromTime(),
  config: GameConfig = DEFAULT_CONFIG,
): GameState {
  const board = emptyBoard();
  const wave = makeWave(board, seed, config.colors);
  return {
    board,
    tray: wave.tray,
    score: 0,
    combo: 0,
    movesSinceClear: 0,
    status: 'playing',
    reviveUsed: false,
    rngState: wave.rngState,
  };
}

export function place(
  state: GameState,
  trayIndex: number,
  r: number,
  c: number,
  config: GameConfig = DEFAULT_CONFIG,
): { state: GameState; event: PlacementEvent } {
  if (state.status !== 'playing') throw new Error('place: game is over');
  const piece = state.tray[trayIndex];
  if (!piece) throw new Error(`place: tray slot ${trayIndex} is empty`);
  if (!canPlace(state.board, piece.shape, r, c)) {
    throw new Error(`place: invalid position (${r}, ${c}) for ${piece.shape.id}`);
  }

  const placedRes = applyPlacement(state.board, piece.shape, r, c, piece.colorId);
  const { rows, cols } = findFullLines(placedRes.board);
  const lines = rows.length + cols.length;

  let board = placedRes.board;
  let clearedCells: [number, number][] = [];
  let clearedColors: number[] = [];
  if (lines > 0) {
    const preClear = board;
    const cleared = clearLines(board, rows, cols);
    board = cleared.board;
    clearedCells = cleared.clearedCells;
    clearedColors = clearedCells.map(([cr, cc]) => preClear[idx(cr, cc)]);
  }

  let combo = state.combo;
  let movesSinceClear = state.movesSinceClear;
  if (lines > 0) {
    combo += 1;
    movesSinceClear = 0;
  } else {
    movesSinceClear += 1;
    if (movesSinceClear > config.scoring.comboForgiveness) combo = 0;
  }

  const boardCleared = lines > 0 && isBoardEmpty(board);
  const scoreDelta = scorePlacement(
    piece.shape.cells.length,
    clearedCells.length,
    lines,
    combo,
    boardCleared,
    config.scoring,
  );
  const score = state.score + scoreDelta;

  let tray = state.tray.slice();
  tray[trayIndex] = null;
  let rngState = state.rngState;
  let newTray = false;
  let newTrayPlayable = true;
  if (tray.every((p) => p === null)) {
    const wave = makeWave(board, rngState, config.colors);
    tray = wave.tray;
    rngState = wave.rngState;
    newTray = true;
    newTrayPlayable = wave.playable;
  }

  const gameOver = newTray ? !newTrayPlayable : !hasAnyMove(board, tray);

  const next: GameState = {
    board,
    tray,
    score,
    combo,
    movesSinceClear,
    status: gameOver ? 'over' : 'playing',
    reviveUsed: state.reviveUsed,
    rngState,
  };
  const event: PlacementEvent = {
    placed: placedRes.cells,
    colorId: piece.colorId,
    clearedRows: rows,
    clearedCols: cols,
    clearedCells,
    clearedColors,
    scoreDelta,
    score,
    combo,
    praise: praiseFor(lines),
    onFire: combo >= 3,
    boardCleared,
    newTray,
    gameOver,
  };
  return { state: next, event };
}

/** Второй шанс: чистая доска, счёт и трей сохраняются. Один раз за партию. */
type RevivableGameState = GameState & { status: 'over'; reviveUsed: false };

export function revive(state: RevivableGameState): GameState;
export function revive(state: GameState): GameState | null;
export function revive(state: GameState): GameState | null {
  if (state.status !== 'over' || state.reviveUsed) return null;

  return {
    ...state,
    board: emptyBoard(),
    combo: 0,
    movesSinceClear: 0,
    status: 'playing',
    reviveUsed: true,
  };
}
