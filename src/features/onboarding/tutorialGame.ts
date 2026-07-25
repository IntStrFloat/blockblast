import {
  applyPlacement,
  canPlace,
  findFullLines,
  findPlacements,
  idx,
} from '@/core/engine/board';
import { SHAPES, SHAPES_BY_ID } from '@/core/engine/shapes';
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

/**
 * A deterministic first-game fixture modelled on Block Blast's opening board:
 * a red/yellow cross leaves a 2×2 center pocket and the only visible piece is
 * the blue square that completes the opening clear in one intentional move.
 */
export function createTutorialGame(seed = 0x46545545): GameState {
  const board: Board = new Array(BOARD_SIZE * BOARD_SIZE).fill(0);
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (row === 3 || row === 4) continue;
    board[idx(row, 3)] = 1;
    board[idx(row, 4)] = 1;
  }
  for (const row of [3, 4]) {
    board[idx(row, 0)] = 1;
    board[idx(row, 1)] = 1;
    board[idx(row, 2)] = 2;
    board[idx(row, 5)] = 2;
    board[idx(row, 6)] = 1;
    board[idx(row, 7)] = 1;
  }

  return {
    board,
    tray: [
      null,
      null,
      { shape: requireShape('sq2'), colorId: 5 },
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

  for (let trayIndex = 0; trayIndex < tray.length; trayIndex += 1) {
    const piece = tray[trayIndex];
    if (!piece) continue;

    for (const [row, col] of findPlacements(board, piece.shape)) {
      const placed = applyPlacement(board, piece.shape, row, col, piece.colorId).board;
      const lines = findFullLines(placed);
      const nextPath = [...path, { trayIndex, row, col, shape: piece.shape }];
      if (lines.rows.length + lines.cols.length > 0) return nextPath;

      const nextTray = tray.slice();
      nextTray[trayIndex] = null;
      const result = searchClearPath(placed, nextTray, remainingDepth - 1, nextPath);
      if (result) return result;
    }
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

/**
 * Adds a real, player-placeable recovery piece to the next generated tray when the
 * current recommendation path was exhausted. No piece is auto-placed.
 */
export function withTutorialRecoveryPiece(
  board: Board,
  nextTray: readonly (PieceInstance | null)[],
  colorId = 3,
): { tray: (PieceInstance | null)[]; recommendation: TutorialRecommendation } | null {
  for (const shape of SHAPES) {
    for (const [row, col] of findPlacements(board, shape)) {
      const placed = applyPlacement(board, shape, row, col, colorId).board;
      const lines = findFullLines(placed);
      if (lines.rows.length + lines.cols.length === 0) continue;

      const tray = nextTray.slice();
      const trayIndex = Math.max(0, tray.findIndex((piece) => piece !== null));
      tray[trayIndex] = { shape, colorId };
      return {
        tray,
        recommendation: {
          trayIndex,
          row,
          col,
          shapeId: shape.id,
          placementsToClear: 1,
          targetCells: shape.cells.map(([dr, dc]) => [row + dr, col + dc]),
        },
      };
    }
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
