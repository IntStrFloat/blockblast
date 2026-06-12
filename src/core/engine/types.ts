export const BOARD_SIZE = 8;
export const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
export const TRAY_SIZE = 3;

/** 0 — пусто, 1..N — colorId */
export type Cell = number;
/** Плоский массив длиной 64, индекс r * 8 + c */
export type Board = Cell[];

export interface Shape {
  id: string;
  /** Клетки [row, col] относительно левого верхнего угла bbox */
  cells: ReadonlyArray<readonly [number, number]>;
  w: number;
  h: number;
  /** Вес в weighted-random генерации волны */
  weight: number;
}

export interface PieceInstance {
  shape: Shape;
  colorId: number;
}

export type GameStatus = 'playing' | 'over';
export type PraiseTier = 'none' | 'good' | 'great' | 'amazing' | 'unbelievable';

export interface GameState {
  board: Board;
  tray: (PieceInstance | null)[];
  score: number;
  /** Текущая серия размещений с очисткой (0 = нет серии) */
  combo: number;
  /** Размещений подряд без очистки (для comboForgiveness) */
  movesSinceClear: number;
  status: GameStatus;
  reviveUsed: boolean;
  rngState: number;
}

export interface PlacementEvent {
  placed: ReadonlyArray<readonly [number, number]>;
  colorId: number;
  clearedRows: number[];
  clearedCols: number[];
  clearedCells: ReadonlyArray<readonly [number, number]>;
  scoreDelta: number;
  score: number;
  combo: number;
  praise: PraiseTier;
  onFire: boolean;
  boardCleared: boolean;
  /** Это размещение исчерпало волну — трей перевыдан */
  newTray: boolean;
  gameOver: boolean;
}

export interface ScoringConfig {
  /** Очки за клетку при размещении */
  perPlacedCell: number;
  /** Очки за каждую очищенную клетку */
  perClearedCell: number;
  /** Бонус по числу линий одним ходом; индекс = min(L, len-1) */
  lineBonus: number[];
  /** Бонус за полностью пустую доску после хода */
  boardClearBonus: number;
  /** Прирост множителя за каждый шаг комбо после первого */
  comboStep: number;
  /** Сколько ходов без очистки прощается до сброса комбо */
  comboForgiveness: number;
}

export interface GameConfig {
  colors: number;
  scoring: ScoringConfig;
  trayPolicy: 'pure' | 'pity';
}
