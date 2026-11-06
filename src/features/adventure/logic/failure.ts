import type { AdventureRun } from '@/core/engine';
import { findHintMove } from '@/features/mascot/logic/helpers';

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

export function findAdventureHelpMove(run: AdventureRun): AdventureHelpMove | null {
  const move = findHintMove(run.game, { adventure: run });
  return move ? { trayIndex: move.trayIndex, row: move.r, col: move.c } : null;
}
