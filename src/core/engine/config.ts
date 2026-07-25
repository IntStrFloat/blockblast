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
  spawn: {
    candidates: 16,
    sizeBias: 4,
    emptyTargetMass: 24,
    fullTargetMass: 6,
    rescueFullness: 0.8,
    rescueDryStreak: 8,
    rescueDryStreakMinFullness: 0.5,
    fallbackNodeLimit: 2500,
  },
};

/** Сколько первых партий игрока считаем «новичковыми» и облегчаем спавн (FTUE). */
export const NOVICE_GAMES = 3;

/**
 * Конфиг спавна под опыт игрока: первые `NOVICE_GAMES` партий получают ассист —
 * (а) `preferClearAssist` тянет трей к фигурам, которыми можно сразу закрыть линию,
 * (б) rescue-режим (мелкие «доборные» фигуры) включается раньше, при 60% заполнения,
 * (в) «сухая» серия без очисток обрывается быстрее, чтобы не было безвыходных треев.
 * От `NOVICE_GAMES` и дальше — база (`DEFAULT_CONFIG`), без облегчений.
 * Не применять к daily-режиму: там сид общий, ассист рассинхронил бы доску между игроками.
 */
export function configForExperience(
  gamesPlayed: number,
  base: GameConfig = DEFAULT_CONFIG,
): GameConfig {
  if (gamesPlayed >= NOVICE_GAMES) return base;
  return {
    ...base,
    spawn: {
      ...base.spawn,
      rescueFullness: 0.6,
      rescueDryStreak: 6,
      rescueDryStreakMinFullness: 0.5,
      preferClearAssist: true,
    },
  };
}
