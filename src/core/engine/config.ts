import type { GameConfig } from './types';

/** Дефолты = формула оригинального Block Blast (спека 00/03). */
export const DEFAULT_CONFIG: GameConfig = {
  colors: 6,
  scoring: {
    perPlacedCell: 1,
    perClearedCell: 10,
    // индекс = число линий одним ходом (0 не используется), потолок 6+
    lineBonus: [0, 10, 20, 60, 120, 200, 300],
    boardClearBonus: 360,
    comboStep: 0.5,
    comboForgiveness: 0,
  },
  trayPolicy: 'pure',
};
