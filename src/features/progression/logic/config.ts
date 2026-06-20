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

export const PROGRESSION_CONFIG: ProgressionConfig = {
  levelCost: { base: 1000, growth: 1.16 },
  tierGaps: [5, 7, 9, 11, 14, 18, 22],
  maxAuthoredLevel: 64,
  evolutionAtWorld: { 1: 1, 2: 2, 4: 3, 6: 4 },
  worldThemeId: { 1: 'classic', 2: 'neon', 3: 'sunset', 4: 'mono', 5: 'aqua', 6: 'galaxy', 7: 'gold' },
  levelRewards: {
    1: { kind: 'cosmetic', id: 'hat-casquette' },
    3: { kind: 'cosmetic', id: 'face-glasses' },
    4: { kind: 'cosmetic', id: 'acc-headphones' },
    5: { kind: 'helper', id: 'hint' },
    8: { kind: 'cosmetic', id: 'skin-mint' },
    9: { kind: 'helper', id: 'swap' },
    10: { kind: 'cosmetic', id: 'hat-panama' },
    12: { kind: 'cosmetic', id: 'face-sunglasses' },
    14: { kind: 'cosmetic', id: 'acc-scarf' },
    16: { kind: 'cosmetic', id: 'skin-coral' },
    17: { kind: 'cosmetic', id: 'hat-beanie' },
    19: { kind: 'cosmetic', id: 'face-star-eyes' },
    20: { kind: 'cosmetic', id: 'acc-backpack' },
  },
};
