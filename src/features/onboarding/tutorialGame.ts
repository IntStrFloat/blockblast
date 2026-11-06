import {
  applyPlacement,
  canPlace,
  findFullLines,
  findPlacements,
  idx,
} from '@/core/engine/board';
import { SHAPES_BY_ID } from '@/core/engine/shapes';
import { BOARD_SIZE } from '@/core/engine/types';
import type { Board, GameState, PieceInstance, Shape } from '@/core/engine/types';

const MAX_RECOMMENDED_PLACEMENTS = 3;

export interface TutorialRecommendation {
  trayIndex: number;
  row: number;
  col: number;
  shapeId: string;
  placementsToClear: number;
  targetCells: readonly (readonly [number, number])[];
}

interface TutorialPathStep {
  trayIndex: number;
  row: number;
  col: number;
  shape: Shape;
}

function requireShape(id: string): Shape {
  const shape = SHAPES_BY_ID.get(id);
  if (!shape) throw new Error(`Tutorial shape is missing: ${id}`);
  return shape;
}

/** The supplied opening: one centered square fills two golden rows. */
export function createTutorialGame(seed = 0x46545545): GameState {
  const board: Board = new Array(BOARD_SIZE * BOARD_SIZE).fill(0);
  for (const row of [5, 6]) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (col !== 3 && col !== 4) board[idx(row, col)] = 3;
    }
  }
  return {
    board,
    tray: [
      null,
      { shape: requireShape('sq2'), colorId: 5 },
      null,
    ],
    score: 0,
    combo: 0,
    movesSinceClear: 0,
    waveNumber: 0,
    status: 'playing',
    reviveUsed: false,
    rngState: seed >>> 0,
  };
}

function searchClearPath(
  board: Board,
  tray: readonly (PieceInstance | null)[],
  remainingDepth: number,
  path: readonly TutorialPathStep[] = [],
): TutorialPathStep[] | null {
  if (remainingDepth === 0) return null;
  let bestClear: TutorialPathStep[] | null = null;
  let bestLineCount = 0;
  const continuations: { board: Board; tray: (PieceInstance | null)[]; path: TutorialPathStep[] }[] = [];

  for (let trayIndex = 0; trayIndex < tray.length; trayIndex += 1) {
    const piece = tray[trayIndex];
    if (!piece) continue;

    for (const [row, col] of findPlacements(board, piece.shape)) {
      const placed = applyPlacement(board, piece.shape, row, col, piece.colorId).board;
      const lines = findFullLines(placed);
      const nextPath = [...path, { trayIndex, row, col, shape: piece.shape }];
      const lineCount = lines.rows.length + lines.cols.length;
      if (lineCount > bestLineCount) {
        bestLineCount = lineCount;
        bestClear = nextPath;
      }

      const nextTray = tray.slice();
      nextTray[trayIndex] = null;
      if (remainingDepth > 1 && lineCount === 0) continuations.push({ board: placed, tray: nextTray, path: nextPath });
    }
  }
  if (bestClear) return bestClear;
  for (const next of continuations) {
    const result = searchClearPath(next.board, next.tray, remainingDepth - 1, next.path);
    if (result) return result;
  }
  return null;
}

/** Recomputes the shortest visible route after every player deviation; it never locks input. */
export function findTutorialRecommendation(
  state: Pick<GameState, 'board' | 'tray'>,
): TutorialRecommendation | null {
  for (let depth = 1; depth <= MAX_RECOMMENDED_PLACEMENTS; depth += 1) {
    const path = searchClearPath(state.board, state.tray, depth);
    const first = path?.[0];
    if (!first || !path) continue;
    return {
      trayIndex: first.trayIndex,
      row: first.row,
      col: first.col,
      shapeId: first.shape.id,
      placementsToClear: path.length,
      targetCells: first.shape.cells.map(([dr, dc]) => [first.row + dr, first.col + dc]),
    };
  }
  return null;
}

export function isTutorialRecommendationValid(
  state: Pick<GameState, 'board' | 'tray'>,
  recommendation: TutorialRecommendation,
): boolean {
  const piece = state.tray[recommendation.trayIndex];
  return Boolean(
    piece &&
      piece.shape.id === recommendation.shapeId &&
      canPlace(state.board, piece.shape, recommendation.row, recommendation.col),
  );
}
