import {
  applyPlacement,
  canPlace,
  clearLines,
  emptyBoard,
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

function makeWave(
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

export function createGame(
  seed: number = seedFromTime(),
  config: GameConfig = DEFAULT_CONFIG,
): GameState {
  const wave = makeWave(seed, config.colors);
  return {
    board: emptyBoard(),
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
  if (tray.every((p) => p === null)) {
    const wave = makeWave(rngState, config.colors);
    tray = wave.tray;
    rngState = wave.rngState;
    newTray = true;
  }

  const gameOver = !hasAnyMove(board, tray);

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

export function replaceTrayPiece(
  state: GameState,
  trayIndex: number,
  config: GameConfig = DEFAULT_CONFIG,
): GameState {
  const exclude = new Set<string>();
  for (let i = 0; i < state.tray.length; i++) {
    if (i !== trayIndex) {
      const slot = state.tray[i];
      if (slot !== null) exclude.add(slot.shape.id);
    }
  }
  const picked = pickWeighted(state.rngState, exclude);
  const color = rngInt(picked.state, config.colors);
  const newTray = state.tray.slice();
  newTray[trayIndex] = { shape: picked.shape, colorId: color.value + 1 };
  return {
    ...state,
    tray: newTray,
    rngState: color.state,
  };
}

/** Второй шанс: чистая доска, счёт и трей сохраняются. Один раз за партию. */
export function revive(state: GameState): GameState {
  return {
    ...state,
    board: emptyBoard(),
    status: 'playing',
    reviveUsed: true,
  };
}
