import { findPlacements } from '@/core/engine';
import type { AdventureRun, Board, PieceInstance } from '@/core/engine';

export const ADVENTURE_HELP_MAX_LEVEL_INDEX = 4;
export const ADVENTURE_HELP_FAILURE_THRESHOLD = 2;

export type AdventureFailureTip = 'collect_jewel_line' | 'open_space' | 'finish_line';

export interface AdventureFailurePresentation {
  current: number;
  target: number;
  remaining: number;
  tip: AdventureFailureTip;
}

export interface AdventureHelpMove {
  trayIndex: number;
  row: number;
  col: number;
}

export function adventureFailurePresentation(run: AdventureRun): AdventureFailurePresentation {
  const current = run.level.objective.type === 'score'
    ? run.game.score
    : run.collectedJewels;
  const target = run.level.objective.target;
  const occupied = run.game.board.reduce((count, cell) => count + (cell === 0 ? 0 : 1), 0);
  const tip: AdventureFailureTip = run.level.objective.type === 'jewels'
    ? 'collect_jewel_line'
    : occupied >= 36
      ? 'open_space'
      : 'finish_line';
  return {
    current,
    target,
    remaining: Math.max(0, target - current),
    tip,
  };
}

export function shouldOfferAdventureHelp(levelIndex: number, failureCount: number): boolean {
  return levelIndex <= ADVENTURE_HELP_MAX_LEVEL_INDEX &&
    failureCount >= ADVENTURE_HELP_FAILURE_THRESHOLD;
}

/** Deterministic valid opening highlight. It never claims a move on a terminal board. */
export function findAdventureHelpMove(
  board: Board,
  tray: readonly (PieceInstance | null)[],
): AdventureHelpMove | null {
  for (let trayIndex = 0; trayIndex < tray.length; trayIndex += 1) {
    const piece = tray[trayIndex];
    if (!piece) continue;
    const placement = findPlacements(board, piece.shape)[0];
    if (placement) return { trayIndex, row: placement[0], col: placement[1] };
  }
  return null;
}

