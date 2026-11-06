import type { AdventureCellPrefill } from '@/core/engine';

import { ADVENTURE_CONFIG } from './config';

function isReserved(row: number, col: number): boolean {
  return row < 2 && col < 4;
}

export function prefillFor(levelIndex: number, jewelCount: number): AdventureCellPrefill[] {
  const count = Math.min(
    ADVENTURE_CONFIG.prefillMaxCells,
    ADVENTURE_CONFIG.prefillBaseCells +
      Math.floor(levelIndex / ADVENTURE_CONFIG.prefillStepEvery) * 3,
  );
  const cells: AdventureCellPrefill[] = [];
  let cursor = levelIndex * 11 + 5;

  while (cells.length < count) {
    const row = Math.floor(cursor / 8) % 8;
    const col = cursor % 8;
    cursor = (cursor + 13) % 64;
    if (isReserved(row, col)) continue;
    if (cells.some((cell) => cell.row === row && cell.col === col)) continue;
    cells.push({ row, col, colorId: ((row + levelIndex) % 7) + 1 });
  }

  // Джевелы раздаём по уникальным индексам, равномерно по списку клеток:
  // шаг-по-модулю зацикливался при cells.length, кратном шагу, и терял джевелы.
  const jewelSlots = Math.min(jewelCount, cells.length);
  for (let i = 0; i < jewelSlots; i += 1) {
    cells[Math.floor((i * cells.length) / jewelSlots)].jewel = true;
  }

  if (levelIndex >= 3) {
    const stone = cells.find((cell) => !cell.jewel);
    if (stone) stone.stoneHits = 2;
  }
  return cells;
}
