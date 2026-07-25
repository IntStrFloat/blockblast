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
  cells: readonly (readonly [number, number])[];
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
  /** Number of fully dealt trays already completed in this game. */
  waveNumber: number;
  status: GameStatus;
  reviveUsed: boolean;
  rngState: number;
}

export interface PlacementEvent {
  placed: readonly (readonly [number, number])[];
  colorId: number;
  clearedRows: number[];
  clearedCols: number[];
  clearedCells: readonly (readonly [number, number])[];
  /** Цвета очищенных клеток (параллельно clearedCells) — для анимации исчезновения */
  clearedColors: number[];
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

export interface SpawnConfig {
  /** Trays sampled per deal; the one whose mass is closest to the fullness target wins. */
  candidates: number;
  /** Exponent magnitude on a shape's cell count when sampling candidates. The effective
   *  exponent is `+sizeBias` on an empty board (favours big figures) and `−sizeBias` on a
   *  full board (favours small), crossing 0 at half-full. */
  sizeBias: number;
  /** Target tray mass on an empty board — high, so the early game deals big blocks
   *  (several 3×3 / 2×2). */
  emptyTargetMass: number;
  /** Target tray mass on a full board (and in rescue) — low, so packed boards get small,
   *  gap-filling pieces. */
  fullTargetMass: number;
  /** Board fullness (0..1) at/above which the rescue (small) target is forced. */
  rescueFullness: number;
  /** Consecutive no-clear placements that also force the rescue target. */
  rescueDryStreak: number;
  /** Hard cap for exhaustive fallback search nodes during tray refill. */
  fallbackNodeLimit?: number;
  /** FTUE assist: when set, prefer dealt trays that let the player complete a line
   *  right now (helps guarantee an early clear in the first games). See docs/specs/03. */
  preferClearAssist?: boolean;
}

export interface GameConfig {
  colors: number;
  scoring: ScoringConfig;
  trayPolicy: 'pure' | 'pity';
  /** Board-fullness-adaptive piece spawning (see docs/specs/03 "Dynamic spawn director"). */
  spawn: SpawnConfig;
}
