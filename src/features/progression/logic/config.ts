import type { HelperId, Stage } from './types';

export interface ProgressionConfig {
  levelCost: { base: number; growth: number };
  tierGaps: number[];
  maxAuthoredLevel: number;
  evolutionAtWorld: Partial<Record<number, Stage>>;
  worldThemeId: Partial<Record<number, string>>;
  levelRewards: Partial<
    Record<number, { kind: 'cosmetic'; id: string } | { kind: 'helper'; id: HelperId }>
  >;
}

// Кривая (retention фаза 2, ×3 по решению пользователя 2026-07-09: 2500 ощущался
// слишком быстрым — level-up на первом же game over): уровень 1 ≈ 3–4 медианные
// партии, мир 2 ≈ неделя активной игры. Медианная партия ≈ 1000 очков (DAILY_CONFIG).
// Старты миров при tierGaps [3,4,5,6,8,10] → [1,4,8,13,19,27,37]; levelRewards
// НЕ ставить на старты миров — там их шэдоуит world-награда (rewardForLevel).
export const PROGRESSION_CONFIG: ProgressionConfig = {
  levelCost: { base: 7500, growth: 1.12 },
  tierGaps: [3, 4, 5, 6, 8, 10],
  maxAuthoredLevel: 64,
  evolutionAtWorld: { 1: 1, 2: 2, 4: 3, 6: 4 },
  worldThemeId: { 1: 'classic', 2: 'neon', 3: 'sunset', 4: 'mono', 5: 'aqua', 6: 'galaxy', 7: 'gold' },
  levelRewards: {
    1: { kind: 'cosmetic', id: 'hat-casquette' },
    2: { kind: 'helper', id: 'hint' },
    3: { kind: 'cosmetic', id: 'face-glasses' },
    5: { kind: 'cosmetic', id: 'acc-headphones' },
    6: { kind: 'helper', id: 'swap' },
    7: { kind: 'cosmetic', id: 'skin-mint' },
    9: { kind: 'cosmetic', id: 'hat-panama' },
    11: { kind: 'cosmetic', id: 'face-sunglasses' },
    14: { kind: 'cosmetic', id: 'acc-scarf' },
    16: { kind: 'cosmetic', id: 'skin-coral' },
    18: { kind: 'cosmetic', id: 'hat-beanie' },
    21: { kind: 'cosmetic', id: 'face-star-eyes' },
    24: { kind: 'cosmetic', id: 'acc-backpack' },
  },
};
