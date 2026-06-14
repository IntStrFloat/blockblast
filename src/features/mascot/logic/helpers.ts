/**
 * Чистая логика мягких помощников Капи (спека 09 §9). Ноль импортов React/RN —
 * только движок. Покрыта тестами; UI-компоненты (HelperHint/HelperSwap) лишь
 * визуализируют эти решения и НЕ делают ход за игрока.
 */
import { findPlacements, hasPlacement } from '@/core/engine';
import type { Board, PieceInstance } from '@/core/engine';

const SIZE = 8;

export interface HintMove {
  trayIndex: number;
  r: number;
  c: number;
}

/** Сколько линий соберёт постановка фигуры в (r,c) — симуляция на копии доски. */
function linesClearedBy(
  board: Board,
  cells: readonly (readonly [number, number])[],
  r: number,
  c: number,
): number {
  const tmp = board.slice();
  for (const [dr, dc] of cells) tmp[(r + dr) * SIZE + (c + dc)] = 1;

  let lines = 0;
  for (let row = 0; row < SIZE; row++) {
    let full = true;
    for (let col = 0; col < SIZE; col++) {
      if (tmp[row * SIZE + col] === 0) {
        full = false;
        break;
      }
    }
    if (full) lines++;
  }
  for (let col = 0; col < SIZE; col++) {
    let full = true;
    for (let row = 0; row < SIZE; row++) {
      if (tmp[row * SIZE + col] === 0) {
        full = false;
        break;
      }
    }
    if (full) lines++;
  }
  return lines;
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

/**
 * Лучшая подсказка: ход, очищающий максимум линий; при равенстве — первый
 * найденный. null, если ни одна фигура трея не помещается.
 */
export function findHintMove(
  board: Board,
  tray: readonly (PieceInstance | null)[],
): HintMove | null {
  let best: HintMove | null = null;
  let bestLines = -1;
  for (let i = 0; i < tray.length; i++) {
    const p = tray[i];
    if (!p) continue;
    for (const [r, c] of findPlacements(board, p.shape)) {
      const lines = linesClearedBy(board, p.shape.cells, r, c);
      if (lines > bestLines) {
        bestLines = lines;
        best = { trayIndex: i, r, c };
      }
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
