import { ADVENTURE_CONFIG } from './config';
import { isMilestone } from './levels';

export interface SeasonTile {
  index: number;
  row: number;
  col: number;
  color: string;
  milestone: boolean;
}

export interface AdventureSeason {
  id: number;
  titleKey: string;
  rows: number;
  cols: number;
  tiles: SeasonTile[];
}

const CAPYBARA_PALETTE = ['#E39B3D', '#C97A34', '#754729', '#9B633A', '#E6B55A', '#5C3827'];
const CAPYBARA_SHAPE = [
  [4, 5, 6, 7],
  [2, 3, 4, 5, 6, 7, 8],
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
  [4, 5, 6, 7, 8],
  [3, 4, 5, 6, 7, 8, 9],
  [2, 3, 4, 5, 6, 7, 8, 9],
  [2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
  [2, 3, 4, 5, 6],
] as const;

// Порядок закраски мозаики — снизу вверх по силуэту, как в оригинале (спека 17 §2.1).
const TILE_FILL_ORDER: Array<{ row: number; col: number }> = CAPYBARA_SHAPE.flatMap(
  (_, i) => {
    const row = CAPYBARA_SHAPE.length - 1 - i;
    return CAPYBARA_SHAPE[row].map((col) => ({ row, col }));
  },
);

export function seasonLength(_seasonId = 1): number {
  return ADVENTURE_CONFIG.seasonTileCount;
}

/** Сквозной номер уровня для отображения: прошлые сезоны + позиция в текущем. */
export function absoluteLevelNumber(seasonId: number, levelIndex: number): number {
  let completed = 0;
  for (let s = 1; s < seasonId; s += 1) completed += seasonLength(s);
  return completed + levelIndex + 1;
}

export function seasonTiles(seasonId = 1): SeasonTile[] {
  return TILE_FILL_ORDER
    .slice(0, seasonLength(seasonId))
    .map(({ row, col }, index) => ({
      index,
      row,
      col,
      color: CAPYBARA_PALETTE[(index + seasonId) % CAPYBARA_PALETTE.length],
      milestone: isMilestone(index),
    }));
}

export function seasonById(seasonId = 1): AdventureSeason {
  return {
    id: seasonId,
    titleKey: 'adventure.season.capybara',
    rows: CAPYBARA_SHAPE.length,
    cols: 11,
    tiles: seasonTiles(seasonId),
  };
}
