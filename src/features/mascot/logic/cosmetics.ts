import type { Cosmetic } from './types';

/**
 * Каталог косметики Капи.
 * ≥ 22 предмета, покрывают все слоты, доступны с разных стадий.
 * id-шники должны совпадать с теми, что используются в MASCOT_CONFIG.rewards.
 */
export const COSMETICS: Cosmetic[] = [
  // --- hat (6 предметов) ---
  { id: 'hat-casquette',    slot: 'hat', minStage: 1 },
  { id: 'hat-block-crown',  slot: 'hat', minStage: 2 },
  { id: 'hat-panama',       slot: 'hat', minStage: 1 },
  { id: 'hat-beanie',       slot: 'hat', minStage: 1 },
  { id: 'hat-tophat',       slot: 'hat', minStage: 3 },
  { id: 'hat-halo',         slot: 'hat', minStage: 4 },

  // --- face (5 предметов) ---
  { id: 'face-glasses',     slot: 'face', minStage: 1 },
  { id: 'face-sunglasses',  slot: 'face', minStage: 1 },
  { id: 'face-star-eyes',   slot: 'face', minStage: 2 },
  { id: 'face-monocle',     slot: 'face', minStage: 2 },
  { id: 'face-vr-visor',    slot: 'face', minStage: 3 },

  // --- accessory (5 предметов) ---
  { id: 'acc-headphones',   slot: 'accessory', minStage: 1 },
  { id: 'acc-scarf',        slot: 'accessory', minStage: 1 },
  { id: 'acc-backpack',     slot: 'accessory', minStage: 2 },
  { id: 'acc-cape',         slot: 'accessory', minStage: 3 },
  { id: 'acc-jetpack',      slot: 'accessory', minStage: 4 },

  // --- skin (4 предмета) ---
  { id: 'skin-mint',        slot: 'skin', minStage: 1 },
  { id: 'skin-coral',       slot: 'skin', minStage: 1 },
  { id: 'skin-chrome',      slot: 'skin', minStage: 3 },
  { id: 'skin-obsidian',    slot: 'skin', minStage: 3 },

  // --- aura (4 предмета) ---
  { id: 'aura-sparkles',    slot: 'aura', minStage: 4 },
  { id: 'aura-stars',       slot: 'aura', minStage: 4 },
  { id: 'aura-rainbow',     slot: 'aura', minStage: 4 }, // зарезервировано, не выдаётся ни на одном уровне
  { id: 'aura-fire',        slot: 'aura', minStage: 4 }, // зарезервировано, не выдаётся ни на одном уровне
];
