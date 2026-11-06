/**
 * Чистая логика мягких помощников Капи (спека 09 §9). Ноль импортов React/RN —
 * только движок. Покрыта тестами; UI-компоненты (HelperHint/HelperSwap) лишь
 * визуализируют эти решения и НЕ делают ход за игрока.
 */
import { findPlacements, hasPlacement, place, placeAdventure } from '@/core/engine';
import type { AdventureRun, Board, GameConfig, GameState, PieceInstance } from '@/core/engine';

export interface HintMove {
  trayIndex: number;
  r: number;
  c: number;
}

/** Суммарное число валидных позиций для всех непустых фигур трея. */
export function countTrayPlacements(
  board: Board,
  tray: readonly (PieceInstance | null)[],
): number {
  let total = 0;
  for (const p of tray) {
    if (p) total += findPlacements(board, p.shape).length;
  }
  return total;
}

function* legalMoves({ board, tray }: GameState): Generator<HintMove> {
  for (let trayIndex = 0; trayIndex < tray.length; trayIndex++) {
    const piece = tray[trayIndex];
    if (!piece) continue;
    for (const [r, c] of findPlacements(board, piece.shape)) yield { trayIndex, r, c };
  }
}

/** Find a move with a playable path to the next tray, or a level win. */
export function findHintMove(
  game: GameState,
  { config, adventure }: { config?: GameConfig; adventure?: AdventureRun | null } = {},
): HintMove | null {
  if (game.status !== 'playing' || (adventure && adventure.status !== 'playing')) return null;

  function simulate(state: GameState, run: AdventureRun | null, move: HintMove) {
    const { trayIndex, r, c } = move;
    if (run) {
      const next = placeAdventure(run, trayIndex, r, c, config);
      return { state: next.run.game, run: next.run, event: next.event, jewels: next.event.jewelsCollectedThisMove };
    }
    const next = place(state, trayIndex, r, c, config);
    return { ...next, run: null, jewels: 0 };
  }

  function canContinue(turn: ReturnType<typeof simulate>): boolean {
    if (turn.run?.status === 'won') return true;
    if (turn.state.status === 'over') return false;
    if (turn.event.newTray) return true;
    for (const move of legalMoves(turn.state)) {
      if (canContinue(simulate(turn.state, turn.run, move))) return true;
    }
    return false;
  }

  let best: HintMove | null = null;
  let bestJewels = -1;
  let bestLines = -1;
  for (const move of legalMoves(game)) {
    const turn = simulate(game, adventure ?? null, move);
    if (turn.run?.status === 'won') return move;
    const lines = turn.event.clearedRows.length + turn.event.clearedCols.length;
    const better = turn.jewels > bestJewels || (turn.jewels === bestJewels && lines > bestLines);
    if (better && canContinue(turn)) {
      best = move;
      bestJewels = turn.jewels;
      bestLines = lines;
    }
  }
  return best;
}

/** Индекс первой непомещаемой фигуры трея (для свопа) или null. */
export function findSwapTarget(
  board: Board,
  tray: readonly (PieceInstance | null)[],
): number | null {
  for (let i = 0; i < tray.length; i++) {
    const p = tray[i];
    if (p && !hasPlacement(board, p.shape)) return i;
  }
  return null;
}

/**
 * «Затык»: ход ещё есть, но валидных позиций мало (≤ threshold) — момент, когда
 * подсказка уместна. На свободной доске (много ходов) возвращает false: ноль
 * ложных срабатываний.
 */
export function isStuckish(
  board: Board,
  tray: readonly (PieceInstance | null)[],
  threshold: number,
): boolean {
  const total = countTrayPlacements(board, tray);
  return total >= 1 && total <= threshold;
}
