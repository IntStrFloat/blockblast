export const ADVENTURE_CONFIG = {
  // Цель дня: 5 уровней ≈ 10–15 минут — досягаемо казуалом (retention фаза 1;
  // выполнение выдаёт ступень 2 дейли-бонуса — гарантированный дроп).
  milestoneEvery: 10,
  seasonTileCount: 96,
  scoreBaseTarget: 128,
  scoreStep: 28,
  scoreMilestoneMultiplier: 1.35,
  jewelStartLevel: 0,
  jewelBaseTarget: 9,
  jewelEveryLevels: 1,
  prefillBaseCells: 8,
  prefillStepEvery: 5,
  prefillMaxCells: 22,
  seedBase: 73001,
  // Смена скина игровой зоны: новый дизайн каждые N уровней по сквозному номеру.
  skinEveryLevels: 10,
} as const;

/**
 * Эксклюзивная косметика Капи за завершение сезона (retention фаза 3).
 * Предметы не пересекаются с dailyCosmeticPool, levelRewards и призами турнира.
 */
export const SEASON_REWARDS: Readonly<Record<number, string>> = {
  1: 'acc-jetpack',
  2: 'aura-sparkles',
  3: 'aura-stars',
  4: 'aura-rainbow',
  5: 'aura-fire',
};

export function seasonRewardCosmetic(seasonId: number): string | null {
  return SEASON_REWARDS[seasonId] ?? null;
}
