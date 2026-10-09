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
export const NOVICE_GAMES = 6;

const NOVICE_SPAWN_STEPS = [
  {
    untilGamesPlayed: 1,
    spawn: {
      rescueFullness: 0.58,
      rescueDryStreak: 5,
      rescueDryStreakMinFullness: 0.5,
      preferClearAssist: true,
    },
  },
  {
    untilGamesPlayed: 3,
    spawn: {
      rescueFullness: 0.64,
      rescueDryStreak: 6,
      rescueDryStreakMinFullness: 0.5,
      preferClearAssist: true,
    },
  },
  {
    untilGamesPlayed: 5,
    spawn: {
      rescueFullness: 0.72,
      rescueDryStreak: 7,
      rescueDryStreakMinFullness: 0.5,
    },
  },
] as const;

/**
 * Конфиг спавна под опыт игрока: первые `NOVICE_GAMES` партий проходят через
 * три ступени FTUE-ассиста вместо резкого cliff после 3-й партии:
 * (а) в первых 2 партиях почти гарантируем раннюю очистку и раньше включаем rescue,
 * (б) в партиях 3–4 ещё держим clear-assist, но уже ослабляем rescue,
 * (в) в партиях 5–6 оставляем только мягкий pity по rescue-порогам.
 * Дальше — база (`DEFAULT_CONFIG`), без облегчений.
 * Не применять к daily-режиму: там сид общий, ассист рассинхронил бы доску между игроками.
 */
export function configForExperience(
  gamesPlayed: number,
  base: GameConfig = DEFAULT_CONFIG,
): GameConfig {
  const step = NOVICE_SPAWN_STEPS.find((candidate) => gamesPlayed <= candidate.untilGamesPlayed);
  if (!step) return base;
  return {
    ...base,
    spawn: {
      ...base.spawn,
      ...step.spawn,
    },
  };
}
