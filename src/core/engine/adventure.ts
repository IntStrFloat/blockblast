import { emptyBoard, idx } from './board';
import { DEFAULT_CONFIG } from './config';
import { createGame, place } from './game';
import { rngInt } from './rng';
import { SHAPES_BY_ID } from './shapes';
import { BOARD_CELLS, TRAY_SIZE } from './types';
import type { Board, GameConfig, GameState, PlacementEvent } from './types';

export type AdventureObjective =
  | { type: 'score'; target: number }
  | { type: 'jewels'; target: number };

export interface AdventureLevelSpec {
  id: string;
  seasonId: number;
  levelIndex: number;
  seed: number;
  objective: AdventureObjective;
  prefill?: readonly AdventureCellPrefill[];
  jewelTrayCells?: readonly AdventureTrayJewel[];
}

export interface AdventureCellPrefill {
  row: number;
  col: number;
  colorId?: number;
  jewel?: boolean;
}

export interface AdventureTrayJewel {
  slot: number;
  cell: number;
}

export type AdventureRunStatus = 'playing' | 'won' | 'failed';
export type AdventureHelpPolicy = 'none' | 'highlight' | 'declined';

export interface AdventureRun {
  runId: string;
  level: AdventureLevelSpec;
  attempt: number;
  game: GameState;
  status: AdventureRunStatus;
  jewelsOnBoard: number[];
  jewelsInTray: AdventureTrayJewel[];
  collectedJewels: number;
  /** Consecutive settled failures for this personal campaign level. */
  failureCount: number;
  /** Explicit choice made before this attempt; rules never change mid-run. */
  helpPolicy: AdventureHelpPolicy;
  /** Becomes true atomically with the first accepted assisted placement. */
  helpUsed: boolean;
  outcomeSettledAt: number | null;
}

export interface AdventurePlacementEvent extends PlacementEvent {
  /** Stable identity shared by all presentation consumers for this accepted move. */
  presentationId: string;
  adventureStatus: AdventureRunStatus;
  collectedJewels: number;
  remainingJewels: number;
  jewelsCollectedThisMove: number;
  /** Exact board indexes used by the UI flight-to-objective animation. */
  collectedJewelCells: number[];
  jewelsPlacedThisMove: number;
}

export const ADVENTURE_GAME_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  colors: 1,
  scoring: {
    ...DEFAULT_CONFIG.scoring,
    comboForgiveness: 0,
  },
};

function boardFromPrefill(prefill: readonly AdventureCellPrefill[] = []): {
  board: Board;
  jewels: number[];
} {
  const board = emptyBoard();
  const jewels: number[] = [];
  for (const cell of prefill) {
    if (cell.row < 0 || cell.row >= 8 || cell.col < 0 || cell.col >= 8) continue;
    const i = idx(cell.row, cell.col);
    board[i] = cell.colorId ?? 1;
    if (cell.jewel) jewels.push(i);
  }
  return { board, jewels };
}

function withDeterministicTrayJewels(
  game: GameState,
  seed: number,
  target: number,
): AdventureTrayJewel[] {
  const markers: AdventureTrayJewel[] = [];
  let state = seed || 1;
  for (let slot = 0; slot < game.tray.length && markers.length < target; slot += 1) {
    const piece = game.tray[slot];
    if (!piece || piece.shape.cells.length === 0) continue;
    const picked = rngInt(state, piece.shape.cells.length);
    state = picked.state;
    markers.push({ slot, cell: picked.value });
  }
  return markers;
}

export function createAdventureRun(
  level: AdventureLevelSpec,
  attempt = 0,
  config: GameConfig = ADVENTURE_GAME_CONFIG,
  runId = `adventure:${level.id}:${attempt}:${level.seed}`,
  options: {
    failureCount?: number;
    helpPolicy?: AdventureHelpPolicy;
  } = {},
): AdventureRun {
  const { board, jewels } = boardFromPrefill(level.prefill);
  const game = createGame(level.seed + attempt * 1009, config, board);
  const jewelTarget = level.objective.type === 'jewels' ? level.objective.target : 0;
  const trayJewels =
    level.jewelTrayCells?.slice() ??
    withDeterministicTrayJewels(game, level.seed + attempt * 37, Math.max(0, jewelTarget - jewels.length));
  return {
    runId,
    level,
    attempt,
    game,
    status: 'playing',
    jewelsOnBoard: jewels,
    jewelsInTray: trayJewels,
    collectedJewels: 0,
    failureCount: Math.max(0, Math.floor(options.failureCount ?? 0)),
    helpPolicy: options.helpPolicy ?? 'none',
    helpUsed: false,
    outcomeSettledAt: null,
  };
}

function moveTrayJewelsToBoard(
  run: AdventureRun,
  event: PlacementEvent,
  trayIndex: number,
): { jewelsOnBoard: number[]; jewelsInTray: AdventureTrayJewel[]; placed: number } {
  let placed = 0;
  const jewelsOnBoard = run.jewelsOnBoard.slice();
  const jewelsInTray: AdventureTrayJewel[] = [];

  for (const marker of run.jewelsInTray) {
    if (marker.slot !== trayIndex) {
      jewelsInTray.push(marker);
      continue;
    }
    const placedCell = event.placed[marker.cell];
    if (!placedCell) continue;
    jewelsOnBoard.push(idx(placedCell[0], placedCell[1]));
    placed += 1;
  }

  return { jewelsOnBoard, jewelsInTray, placed };
}

export function remainingJewels(run: AdventureRun): number {
  if (run.level.objective.type !== 'jewels') return 0;
  return Math.max(0, run.level.objective.target - run.collectedJewels);
}

function trayJewelTargetFor(run: AdventureRun, jewelsOnBoard: readonly number[], collectedJewels: number): number {
  if (run.level.objective.type !== 'jewels') return 0;
  return Math.max(0, run.level.objective.target - collectedJewels - jewelsOnBoard.length);
}

export function isAdventureWon(run: AdventureRun): boolean {
  if (run.level.objective.type === 'score') {
    return run.game.score >= run.level.objective.target;
  }
  return run.collectedJewels >= run.level.objective.target;
}

export function placeAdventure(
  run: AdventureRun,
  trayIndex: number,
  row: number,
  col: number,
  config: GameConfig = ADVENTURE_GAME_CONFIG,
): { run: AdventureRun; event: AdventurePlacementEvent } {
  if (run.status !== 'playing') throw new Error('placeAdventure: run is not active');

  const result = place(run.game, trayIndex, row, col, config);
  const moved = moveTrayJewelsToBoard(run, result.event, trayIndex);
  const cleared = new Set(result.event.clearedCells.map(([r, c]) => idx(r, c)));
  const collectedJewelCells = moved.jewelsOnBoard.filter((i) => cleared.has(i));
  const jewelsCollectedThisMove = collectedJewelCells.length;
  const jewelsOnBoard = moved.jewelsOnBoard.filter((i) => !cleared.has(i));
  const collectedJewels = run.collectedJewels + jewelsCollectedThisMove;
  const jewelsInTray = result.event.newTray
    ? withDeterministicTrayJewels(
        result.state,
        run.level.seed + run.attempt * 37 + result.state.waveNumber * 101,
        trayJewelTargetFor(run, jewelsOnBoard, collectedJewels),
      )
    : moved.jewelsInTray;

  const nextBase: AdventureRun = {
    ...run,
    game: result.state,
    jewelsOnBoard,
    jewelsInTray,
    collectedJewels,
  };
  const status: AdventureRunStatus = isAdventureWon(nextBase)
    ? 'won'
    : result.state.status === 'over'
      ? 'failed'
      : 'playing';
  const next = { ...nextBase, status };

  return {
    run: next,
    event: {
      ...result.event,
      presentationId: `${run.runId}:${run.attempt}:${result.event.score}`,
      adventureStatus: status,
      collectedJewels,
      remainingJewels: remainingJewels(next),
      jewelsCollectedThisMove,
      collectedJewelCells,
      jewelsPlacedThisMove: moved.placed,
    },
  };
}

interface SerializedAdventureRunV1 {
  v: 1;
  level: AdventureLevelSpec;
  attempt: number;
  game: GameState;
  status: AdventureRunStatus;
  jewelsOnBoard: number[];
  jewelsInTray: AdventureTrayJewel[];
  collectedJewels: number;
}

interface SerializedAdventureRunV2 extends Omit<SerializedAdventureRunV1, 'v'> {
  v: 2;
  runId: string;
  outcomeSettledAt: number | null;
}

interface SerializedAdventureRunV3 extends Omit<SerializedAdventureRunV2, 'v'> {
  v: 3;
  failureCount: number;
  helpPolicy: AdventureHelpPolicy;
  helpUsed: boolean;
}

export function serializeAdventureRun(run: AdventureRun): string {
  const payload: SerializedAdventureRunV3 = {
    v: 3,
    runId: run.runId,
    level: run.level,
    attempt: run.attempt,
    game: run.game,
    status: run.status,
    jewelsOnBoard: run.jewelsOnBoard,
    jewelsInTray: run.jewelsInTray,
    collectedJewels: run.collectedJewels,
    failureCount: run.failureCount,
    helpPolicy: run.helpPolicy,
    helpUsed: run.helpUsed,
    outcomeSettledAt: run.outcomeSettledAt,
  };
  return JSON.stringify(payload);
}

export function deserializeAdventureRun(raw: string): AdventureRun | null {
  try {
    const data = JSON.parse(raw) as Omit<Partial<SerializedAdventureRunV1>, 'v'> & {
      v?: 1 | 2 | 3;
      runId?: string;
      outcomeSettledAt?: number | null;
      failureCount?: number;
      helpPolicy?: AdventureHelpPolicy;
      helpUsed?: boolean;
    };
    if ((data.v !== 1 && data.v !== 2 && data.v !== 3) || !data.level || !data.game) return null;
    if (!Array.isArray(data.jewelsOnBoard) || !Array.isArray(data.jewelsInTray)) return null;
    if (
      typeof data.level.id !== 'string' ||
      !Number.isInteger(data.level.seasonId) ||
      !Number.isInteger(data.level.levelIndex) ||
      !Number.isInteger(data.level.seed) ||
      !data.level.objective ||
      !['score', 'jewels'].includes(data.level.objective.type) ||
      !Number.isFinite(data.level.objective.target)
    ) return null;
    const game = data.game as Partial<GameState>;
    if (
      !Array.isArray(game.board) ||
      game.board.length !== BOARD_CELLS ||
      !game.board.every((cell) => Number.isFinite(cell) && cell >= 0) ||
      !Array.isArray(game.tray) ||
      game.tray.length !== TRAY_SIZE ||
      !Number.isFinite(game.score) ||
      !Number.isFinite(game.combo) ||
      !Number.isFinite(game.movesSinceClear) ||
      !Number.isInteger(game.waveNumber) ||
      (game.status !== 'playing' && game.status !== 'over') ||
      typeof game.reviveUsed !== 'boolean' ||
      !Number.isFinite(game.rngState)
    ) return null;
    const tray: GameState['tray'] = [];
    for (const piece of game.tray) {
      if (piece === null) {
        tray.push(null);
        continue;
      }
      const shape = SHAPES_BY_ID.get(piece?.shape?.id ?? '');
      if (!shape || !Number.isFinite(piece.colorId)) return null;
      tray.push({ shape, colorId: piece.colorId });
    }
    if (
      !data.jewelsOnBoard.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < BOARD_CELLS) ||
      !data.jewelsInTray.every((marker) =>
        Number.isInteger(marker.slot) && marker.slot >= 0 && marker.slot < TRAY_SIZE &&
        Number.isInteger(marker.cell) && marker.cell >= 0,
      )
    ) return null;
    const normalizedGame = { ...(game as GameState), board: [...game.board], tray };
    return {
      runId:
        data.v !== 1 && typeof data.runId === 'string'
          ? data.runId
          : `legacy-adventure:${data.level.id}:${data.attempt ?? 0}:${data.level.seed}`,
      level: data.level,
      attempt: typeof data.attempt === 'number' ? data.attempt : 0,
      game: normalizedGame,
      status: data.status === 'won' || data.status === 'failed' ? data.status : 'playing',
      jewelsOnBoard: data.jewelsOnBoard,
      jewelsInTray: data.jewelsInTray,
      collectedJewels: typeof data.collectedJewels === 'number' ? data.collectedJewels : 0,
      failureCount:
        data.v === 3 && Number.isInteger(data.failureCount) && (data.failureCount ?? -1) >= 0
          ? data.failureCount!
          : 0,
      helpPolicy:
        data.v === 3 && ['none', 'highlight', 'declined'].includes(data.helpPolicy ?? '')
          ? data.helpPolicy!
          : 'none',
      helpUsed: data.v === 3 && data.helpUsed === true,
      outcomeSettledAt:
        data.v !== 1 && typeof data.outcomeSettledAt === 'number'
          ? data.outcomeSettledAt
          : null,
    };
  } catch {
    return null;
  }
}
