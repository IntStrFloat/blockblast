import { emptyBoard, idx } from './board';
import { DEFAULT_CONFIG } from './config';
import { createGame, place } from './game';
import { rngInt } from './rng';
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

export interface AdventureRun {
  level: AdventureLevelSpec;
  attempt: number;
  game: GameState;
  status: AdventureRunStatus;
  jewelsOnBoard: number[];
  jewelsInTray: AdventureTrayJewel[];
  collectedJewels: number;
}

export interface AdventurePlacementEvent extends PlacementEvent {
  adventureStatus: AdventureRunStatus;
  collectedJewels: number;
  remainingJewels: number;
  jewelsCollectedThisMove: number;
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
): AdventureRun {
  const { board, jewels } = boardFromPrefill(level.prefill);
  const game = createGame(level.seed + attempt * 1009, config, board);
  const jewelTarget = level.objective.type === 'jewels' ? level.objective.target : 0;
  const trayJewels =
    level.jewelTrayCells?.slice() ??
    withDeterministicTrayJewels(game, level.seed + attempt * 37, Math.max(0, jewelTarget - jewels.length));
  return {
    level,
    attempt,
    game,
    status: 'playing',
    jewelsOnBoard: jewels,
    jewelsInTray: trayJewels,
    collectedJewels: 0,
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
  const jewelsCollectedThisMove = moved.jewelsOnBoard.filter((i) => cleared.has(i)).length;
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
      adventureStatus: status,
      collectedJewels,
      remainingJewels: remainingJewels(next),
      jewelsCollectedThisMove,
      jewelsPlacedThisMove: moved.placed,
    },
  };
}

interface SerializedAdventureRun {
  v: 1;
  level: AdventureLevelSpec;
  attempt: number;
  game: GameState;
  status: AdventureRunStatus;
  jewelsOnBoard: number[];
  jewelsInTray: AdventureTrayJewel[];
  collectedJewels: number;
}

export function serializeAdventureRun(run: AdventureRun): string {
  const payload: SerializedAdventureRun = {
    v: 1,
    level: run.level,
    attempt: run.attempt,
    game: run.game,
    status: run.status,
    jewelsOnBoard: run.jewelsOnBoard,
    jewelsInTray: run.jewelsInTray,
    collectedJewels: run.collectedJewels,
  };
  return JSON.stringify(payload);
}

export function deserializeAdventureRun(raw: string): AdventureRun | null {
  try {
    const data = JSON.parse(raw) as Partial<SerializedAdventureRun>;
    if (data.v !== 1 || !data.level || !data.game) return null;
    if (!Array.isArray(data.jewelsOnBoard) || !Array.isArray(data.jewelsInTray)) return null;
    return {
      level: data.level,
      attempt: typeof data.attempt === 'number' ? data.attempt : 0,
      game: data.game,
      status: data.status === 'won' || data.status === 'failed' ? data.status : 'playing',
      jewelsOnBoard: data.jewelsOnBoard,
      jewelsInTray: data.jewelsInTray,
      collectedJewels: typeof data.collectedJewels === 'number' ? data.collectedJewels : 0,
    };
  } catch {
    return null;
  }
}
