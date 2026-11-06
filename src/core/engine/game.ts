import {
  applyPlacement,
  canPlace,
  clearLines,
  emptyBoard,
  findPlacements,
  findFullLines,
  hasAnyMove,
  hasPlacement,
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
  SpawnConfig,
} from './types';

type Wave = { tray: PieceInstance[]; rngState: number; playable: boolean };
interface SearchBudget {
  limit: number;
  visited: number;
}

type WeightOf = (shape: Shape) => number;
const baseWeight: WeightOf = (s) => s.weight;

function pickWeighted(
  state: number,
  exclude: ReadonlySet<string>,
  weightOf: WeightOf = baseWeight,
): { shape: Shape; state: number } {
  const pool = SHAPES.filter((s) => !exclude.has(s.id));
  const total = pool.reduce((sum, s) => sum + weightOf(s), 0);
  const r = rngNext(state);
  const target = r.value * total;
  let acc = 0;
  for (const s of pool) {
    acc += weightOf(s);
    if (target < acc) return { shape: s, state: r.state };
  }
  return { shape: pool[pool.length - 1], state: r.state };
}

function makeRandomWave(
  rngState: number,
  colors: number,
  weightOf: WeightOf = baseWeight,
  allowDuplicates = false,
): { tray: PieceInstance[]; rngState: number } {
  const exclude = new Set<string>();
  const tray: PieceInstance[] = [];
  let s = rngState;
  for (let i = 0; i < TRAY_SIZE; i++) {
    const picked = pickWeighted(s, exclude, weightOf);
    if (!allowDuplicates) exclude.add(picked.shape.id);
    s = picked.state;
    const color = rngInt(s, colors);
    s = color.state;
    tray.push({ shape: picked.shape, colorId: color.value + 1 });
  }
  return { tray, rngState: s };
}

/** Total cell count ("mass") of a tray. Exported for spawn-distribution tests. */
export function trayMass(tray: readonly PieceInstance[]): number {
  return tray.reduce((sum, piece) => sum + piece.shape.cells.length, 0);
}

/** Fraction of the board that is filled (0 = empty, 1 = full). Drives spawn size bias. */
function filledFraction(board: Board): number {
  let filled = 0;
  for (const cell of board) if (cell !== 0) filled += 1;
  return filled / board.length;
}

/** Spawn weight as a function of board fullness: heavy figures when the board is empty,
 *  small ones (singles, short lines, S/Z) when it is full. The exponent on cell count
 *  flips sign across half-full; rescue mode clamps it to the small-biased end.
 *  See docs/specs/03 "Dynamic spawn director". */
function spawnWeightOf(
  shape: Shape,
  fullness: number,
  rescue: boolean,
  spawn: SpawnConfig,
): number {
  const exponent = rescue ? -spawn.sizeBias : spawn.sizeBias * (1 - 2 * fullness);
  return shape.weight * shape.cells.length ** exponent;
}

/** Does any piece in the tray complete at least one line on the current board right now?
 *  Drives the FTUE clear-assist bias (config.preferClearAssist). Exported for tests. */
export function trayEnablesClear(board: Board, tray: readonly PieceInstance[]): boolean {
  return tray.some((piece) =>
    findPlacements(board, piece.shape).some(([r, c]) => {
      const placed = applyPlacement(board, piece.shape, r, c, 1).board;
      const { rows, cols } = findFullLines(placed);
      return rows.length > 0 || cols.length > 0;
    }),
  );
}

function boardAfterPlacement(board: Board, shape: Shape, r: number, c: number): Board {
  const placed = applyPlacement(board, shape, r, c, 1).board;
  const { rows, cols } = findFullLines(placed);
  return rows.length > 0 || cols.length > 0 ? clearLines(placed, rows, cols).board : placed;
}

function canPlayEntireTray(
  board: Board,
  tray: readonly PieceInstance[],
  budget?: SearchBudget,
): boolean {
  // Мемо провалов по транспозициям (A→B и B→A дают одну и ту же позицию):
  // резко сокращает работу на «плохих» досках, где поиск вынужден доказать
  // непроходимость, — это горячий путь пересдачи трея на дропе.
  const failed = new Set<string>();

  const search = (currentBoard: Board, remaining: readonly PieceInstance[]): boolean => {
    if (budget) {
      budget.visited += 1;
      if (budget.visited > budget.limit) return false;
    }
    if (remaining.length === 0) return true;

    const occupied = currentBoard.map((cell) => (cell === 0 ? '0' : '1')).join('');
    const memoKey = `${remaining
      .map((p) => p.shape.id)
      .sort()
      .join(',')}:${occupied}`;
    if (failed.has(memoKey)) return false;

    const playable = remaining.some((piece, pieceIndex) =>
      findPlacements(currentBoard, piece.shape).some(([r, c]) =>
        search(
          boardAfterPlacement(currentBoard, piece.shape, r, c),
          remaining.filter((_, index) => index !== pieceIndex),
        ),
      ),
    );
    if (!playable) failed.add(memoKey);
    return playable;
  };

  return search(board, tray);
}

function weightedShapeOrder(
  rngState: number,
  weightOf: WeightOf = baseWeight,
): { shapes: Shape[]; rngState: number } {
  const shapes: Shape[] = [];
  const exclude = new Set<string>();
  let s = rngState;

  while (shapes.length < SHAPES.length) {
    const picked = pickWeighted(s, exclude, weightOf);
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
  budget: SearchBudget,
): Shape[] | null {
  const failed = new Set<string>();

  const search = (
    currentBoard: Board,
    selected: readonly Shape[],
    used: ReadonlySet<string>,
  ): Shape[] | null => {
    budget.visited += 1;
    if (budget.visited > budget.limit) return null;
    if (selected.length === TRAY_SIZE) return selected.slice();

    const occupied = currentBoard.map((cell) => (cell === 0 ? '0' : '1')).join('');
    const usedKey = allowDuplicates ? '' : [...used].sort().join(',');
    const memoKey = `${selected.length}:${usedKey}:${occupied}`;
    if (failed.has(memoKey)) return null;

    for (const shape of shapeOrder) {
      if (!allowDuplicates && used.has(shape.id)) continue;

      for (const [r, c] of findPlacements(currentBoard, shape)) {
        const nextUsed = allowDuplicates ? used : new Set([...used, shape.id]);
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

/** Trays within this many cells of the closest-to-target candidate stay eligible, so
 *  near-target deals keep some compositional variety. */
const SPAWN_MASS_MARGIN = 3;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deals the next tray by aiming at a board-fullness-driven mass target: big on an
 *  empty board (several 3×3 / 2×2), small when packed or rescuing. It samples
 *  size-biased candidate trays (duplicates allowed, like the original) and keeps the one
 *  whose mass is closest to the target, always guaranteeing the whole tray is playable.
 *  See docs/specs/03 "Dynamic spawn director". */
function makeWave(
  board: Board,
  rngState: number,
  config: GameConfig,
  movesSinceClear: number,
): Wave {
  const { spawn } = config;
  const searchBudget: SearchBudget = {
    limit: spawn.fallbackNodeLimit ?? 2500,
    visited: 0,
  };
  const fullness = filledFraction(board);
  // A live JS refresh can retain an active game created before this setting existed.
  const dryStreakMinFullness = spawn.rescueDryStreakMinFullness ?? 0.5;
  const rescue =
    fullness >= spawn.rescueFullness ||
    (movesSinceClear >= spawn.rescueDryStreak && fullness >= dryStreakMinFullness);
  const target = rescue
    ? spawn.fullTargetMass
    : lerp(spawn.emptyTargetMass, spawn.fullTargetMass, fullness);
  const weightOf: WeightOf = (shape) => spawnWeightOf(shape, fullness, rescue, spawn);

  let s = rngState;
  const candidates: { tray: PieceInstance[]; dist: number }[] = [];
  for (let i = 0; i < spawn.candidates; i += 1) {
    const cand = makeRandomWave(s, config.colors, weightOf, true);
    s = cand.rngState;
    if (canPlayEntireTray(board, cand.tray, searchBudget)) {
      candidates.push({ tray: cand.tray, dist: Math.abs(trayMass(cand.tray) - target) });
    }
  }

  if (candidates.length > 0) {
    // FTUE-ассист: если можно, выбираем только среди треев, которыми игрок
    // прямо сейчас закроет линию — так ранняя очистка почти гарантирована.
    let pool = candidates;
    if (spawn.preferClearAssist) {
      const clearing = candidates.filter((c) => trayEnablesClear(board, c.tray));
      if (clearing.length > 0) pool = clearing;
    }
    const closest = pool.reduce((min, c) => Math.min(min, c.dist), Infinity);
    const near = pool.filter((c) => c.dist <= closest + SPAWN_MASS_MARGIN);
    const picked = rngInt(s, near.length);
    return { tray: near[picked.value].tray, rngState: picked.state, playable: true };
  }

  // No sampled candidate is solvable (a very tight board): search a playable sequence in
  // size-biased order so the tray is guaranteed solvable; if even that fails, the game is
  // over and the dealt tray is irrelevant.
  const ordered = weightedShapeOrder(s, weightOf);
  const shapes =
    findPlayableShapeSequence(board, ordered.shapes, true, searchBudget) ??
    findPlayableShapeSequence(board, ordered.shapes, false, searchBudget);

  if (!shapes) {
    // Поиск не нашёл гарантированно проходимый целиком трей (возможно, просто
    // упёрся в бюджет). Это НЕ значит, что ходов нет: сдаём обычный трей, а
    // game over решаем по факту — есть ли хоть один легальный ход. Ложный
    // game over из-за таймаута поиска недопустим.
    const dead = makeRandomWave(ordered.rngState, config.colors, weightOf, true);
    return { ...dead, playable: hasAnyMove(board, dead.tray) };
  }

  let s2 = ordered.rngState;
  const tray = shapes.map((shape) => {
    const color = rngInt(s2, config.colors);
    s2 = color.state;
    return { shape, colorId: color.value + 1 };
  });
  return { tray, rngState: s2, playable: true };
}

export function createGame(
  seed: number = seedFromTime(),
  config: GameConfig = DEFAULT_CONFIG,
  initialBoard?: Board,
): GameState {
  const board = initialBoard ? initialBoard.slice() : emptyBoard();
  const wave = makeWave(board, seed, config, 0);
  return {
    board,
    tray: wave.tray,
    score: 0,
    combo: 0,
    movesSinceClear: 0,
    waveNumber: 0,
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
  let waveNumber = state.waveNumber;
  let newTray = false;
  let newTrayPlayable = true;
  if (tray.every((p) => p === null)) {
    const wave = makeWave(board, rngState, config, movesSinceClear);
    tray = wave.tray;
    rngState = wave.rngState;
    waveNumber += 1;
    newTray = true;
    newTrayPlayable = wave.playable;
  }

  const gameOver = newTray ? !newTrayPlayable : !hasAnyMove(board, tray);

  const next: GameState = {
    lastPiece: { shapeId: piece.shape.id, row: r, col: c, colorId: piece.colorId },
    board,
    tray,
    score,
    combo,
    movesSinceClear,
    waveNumber,
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
  // Замена — спасательная фича: новая фигура обязана помещаться на доску,
  // иначе игрок может остаться вовсе без ходов при статусе playing (софт-лок).
  const placeable = SHAPES.filter((shape) => hasPlacement(state.board, shape));
  if (placeable.length === 0) {
    // Ни одна фигура каталога не влезает — замена не спасёт, партия окончена.
    return { ...state, status: 'over' };
  }

  const otherSlotIds = new Set<string>();
  for (let i = 0; i < state.tray.length; i++) {
    if (i !== trayIndex) {
      const slot = state.tray[i];
      if (slot !== null) otherSlotIds.add(slot.shape.id);
    }
  }
  // Уникальность к другим слотам держим, пока есть из чего выбирать;
  // если влезают только фигуры из других слотов — разрешаем дубликат.
  const unique = placeable.filter((shape) => !otherSlotIds.has(shape.id));
  const pool = new Set((unique.length > 0 ? unique : placeable).map((s) => s.id));
  const exclude = new Set(SHAPES.filter((shape) => !pool.has(shape.id)).map((shape) => shape.id));

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
type RevivableGameState = GameState & { status: 'over'; reviveUsed: false };

export function revive(state: RevivableGameState, config?: GameConfig): GameState;
export function revive(state: GameState, config?: GameConfig): GameState | null;
export function revive(state: GameState, config: GameConfig = DEFAULT_CONFIG): GameState | null {
  if (state.status !== 'over' || state.reviveUsed) return null;

  const board = emptyBoard();
  // A migrated checkpoint can have an empty tray. Deal playable pieces in that case.
  const wave = state.tray.some(Boolean) ? null : makeWave(board, state.rngState, config, 0);
  return {
    ...state,
    board,
    tray: wave?.tray ?? state.tray,
    rngState: wave?.rngState ?? state.rngState,
    lastPiece: undefined,
    combo: 0,
    movesSinceClear: 0,
    status: 'playing',
    reviveUsed: true,
  };
}
