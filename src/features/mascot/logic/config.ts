import type { ActionId, EmoteId, LevelReward, Stage } from './types';

/** Спецификация одного действия в планировщике поведения */
export interface ActionSpec {
  id: ActionId;
  weight: number;
  cooldownMs: number;
  minStage: Stage;
  minDurationMs: number;
  maxDurationMs: number;
  moving?: boolean;
  calm?: boolean;
  nightBoost?: number;
  emote?: EmoteId;
}

/** Описание диапазона уровней одной стадии */
export interface StageBound {
  stage: Stage;
  from: number;
  to: number;
}

export interface MascotConfigType {
  maxLevel: number;
  stageBounds: StageBound[];
  xp: {
    perClearedLine: number;
    comboTierBonus: number;
    newRecord: number;
    boardClear: number;
    dailyFeed: number;
  };
  helpers: {
    hint: { unlockLevel: number; stuckThreshold: number };
    swap: { unlockLevel: number };
  };
  nightHour: number;
  /**
   * Моргание управляется отдельным интервал-таймером.
   * Планировщик поведения (behavior.ts) ОБЯЗАН исключать 'blink' из пула nextAction.
   */
  blink: { minMs: number; maxMs: number };
  actions: ActionSpec[];
  rewards: Partial<Record<number, LevelReward>>;
}

/**
 * Все 28 действий маскота.
 * calm: true  — подходят для любого настроения / тихого режима.
 * moving: true — маскот перемещается по экрану.
 * nightBoost   — множитель веса ночью (nightHour+).
 * Cooldown «спецзаметок» (sneeze, faceplant, ponder) — 40–90 с.
 */
const ACTIONS: ActionSpec[] = [
  // --- Перемещение ---
  { id: 'walkLeft',     weight: 14, cooldownMs:  2000, minStage: 1, minDurationMs: 1200, maxDurationMs: 3000, moving: true },
  { id: 'walkRight',    weight: 14, cooldownMs:  2000, minStage: 1, minDurationMs: 1200, maxDurationMs: 3000, moving: true },

  // --- Спокойные базовые ---
  { id: 'idle',         weight: 20, cooldownMs:   500, minStage: 1, minDurationMs:  800, maxDurationMs: 3000, calm: true },
  { id: 'sit',          weight: 10, cooldownMs:  3000, minStage: 1, minDurationMs: 1500, maxDurationMs: 4000, calm: true },
  { id: 'lieDown',      weight:  6, cooldownMs:  5000, minStage: 1, minDurationMs: 2000, maxDurationMs: 5000, calm: true },
  { id: 'sleep',        weight:  5, cooldownMs: 10000, minStage: 1, minDurationMs: 3000, maxDurationMs: 8000, calm: true, nightBoost: 3, emote: 'sleep' },

  // --- Анимации тела ---
  { id: 'yawn',         weight:  6, cooldownMs:  8000, minStage: 1, minDurationMs: 1200, maxDurationMs: 2000, calm: true },
  { id: 'stretch',      weight:  6, cooldownMs:  8000, minStage: 1, minDurationMs: 1200, maxDurationMs: 2500, calm: true },
  { id: 'scratch',      weight:  5, cooldownMs:  6000, minStage: 1, minDurationMs:  800, maxDurationMs: 1800, calm: true },
  { id: 'groom',        weight:  4, cooldownMs:  9000, minStage: 1, minDurationMs: 1500, maxDurationMs: 3000, calm: true },
  { id: 'sniff',        weight:  5, cooldownMs:  5000, minStage: 1, minDurationMs:  800, maxDurationMs: 1500, calm: true },

  // --- Взгляды ---
  { id: 'lookScore',    weight:  8, cooldownMs:  4000, minStage: 1, minDurationMs:  800, maxDurationMs: 2000, calm: true },
  { id: 'lookBoard',    weight:  8, cooldownMs:  4000, minStage: 1, minDurationMs:  800, maxDurationMs: 2000, calm: true },
  { id: 'lookPlayer',   weight:  7, cooldownMs:  4000, minStage: 1, minDurationMs:  800, maxDurationMs: 2000, calm: true },
  { id: 'peekDown',     weight:  5, cooldownMs:  7000, minStage: 1, minDurationMs: 1000, maxDurationMs: 2000, calm: true },

  // --- Социальные ---
  { id: 'wave',         weight:  6, cooldownMs:  9000, minStage: 1, minDurationMs:  800, maxDurationMs: 1500 },

  // --- Блочные трюки ---
  { id: 'balanceBlock', weight:  5, cooldownMs: 12000, minStage: 2, minDurationMs: 1500, maxDurationMs: 3000 },
  { id: 'rollBlock',    weight:  4, cooldownMs: 12000, minStage: 2, minDurationMs: 1200, maxDurationMs: 2500 },
  { id: 'pushBlock',    weight:  4, cooldownMs: 12000, minStage: 2, minDurationMs: 1200, maxDurationMs: 2500 },

  // --- Танцы / Спин (стадия 2+) ---
  { id: 'dance',        weight:  5, cooldownMs: 15000, minStage: 2, minDurationMs: 2000, maxDurationMs: 4000 },
  { id: 'spin',         weight:  4, cooldownMs: 10000, minStage: 2, minDurationMs:  800, maxDurationMs: 1500 },
  { id: 'hop',          weight:  5, cooldownMs:  7000, minStage: 2, minDurationMs:  600, maxDurationMs: 1200 },

  // --- Мыслительные ---
  { id: 'ponder',       weight:  2, cooldownMs: 60000, minStage: 1, minDurationMs: 2000, maxDurationMs: 4000, calm: true, emote: 'think' },

  // --- Особые эффекты ---
  { id: 'sparkleIdle',  weight:  3, cooldownMs: 20000, minStage: 3, minDurationMs: 1500, maxDurationMs: 3000, calm: true, emote: 'sparkle' },

  // --- Редкие «приколы» ---
  { id: 'sneeze',       weight:  1, cooldownMs: 45000, minStage: 1, minDurationMs:  800, maxDurationMs: 1500, emote: 'excl' },
  { id: 'wobble',       weight:  2, cooldownMs: 30000, minStage: 1, minDurationMs:  800, maxDurationMs: 1500 },
  { id: 'faceplant',    weight:  1, cooldownMs: 90000, minStage: 1, minDurationMs: 1200, maxDurationMs: 2000 },

  // --- Моргание (очень частое, отдельный таймер, но включено в список) ---
  { id: 'blink',        weight: 12, cooldownMs:  2200, minStage: 1, minDurationMs:  150, maxDurationMs:  300, calm: true },
];

/**
 * Карта наград за каждый уровень 1..24.
 * Уровни 5 и 12 — помощники; все остальные 22 — косметика.
 *
 * Косметические id в том же порядке, что и в COSMETICS (cosmetics.ts),
 * чтобы тесты могли проверить соответствие.
 */
const REWARDS: Record<number, LevelReward> = {
   1: { kind: 'cosmetic', id: 'hat-casquette' },
   2: { kind: 'cosmetic', id: 'face-glasses' },
   3: { kind: 'cosmetic', id: 'acc-headphones' },
   4: { kind: 'cosmetic', id: 'skin-mint' },
   5: { kind: 'helper',   id: 'hint' },
   6: { kind: 'cosmetic', id: 'hat-panama' },
   7: { kind: 'cosmetic', id: 'face-sunglasses' },
   8: { kind: 'cosmetic', id: 'acc-scarf' },
   9: { kind: 'cosmetic', id: 'skin-coral' },
  10: { kind: 'cosmetic', id: 'hat-beanie' },
  11: { kind: 'cosmetic', id: 'face-star-eyes' },
  12: { kind: 'helper',   id: 'swap' },
  13: { kind: 'cosmetic', id: 'acc-backpack' },
  14: { kind: 'cosmetic', id: 'hat-block-crown' },
  15: { kind: 'cosmetic', id: 'face-monocle' },
  16: { kind: 'cosmetic', id: 'skin-chrome' },
  17: { kind: 'cosmetic', id: 'hat-tophat' },
  18: { kind: 'cosmetic', id: 'face-vr-visor' },
  19: { kind: 'cosmetic', id: 'acc-cape' },
  20: { kind: 'cosmetic', id: 'skin-obsidian' },
  21: { kind: 'cosmetic', id: 'aura-sparkles' },
  22: { kind: 'cosmetic', id: 'aura-stars' },
  23: { kind: 'cosmetic', id: 'acc-jetpack' },
  24: { kind: 'cosmetic', id: 'hat-halo' },
};

export const MASCOT_CONFIG: MascotConfigType = {
  maxLevel: 24,

  stageBounds: [
    { stage: 1, from:  1, to:  4 },
    { stage: 2, from:  5, to: 11 },
    { stage: 3, from: 12, to: 19 },
    { stage: 4, from: 20, to: 24 },
  ],

  xp: {
    perClearedLine:  3,
    comboTierBonus:  1,
    newRecord:      50,
    boardClear:     20,
    dailyFeed:      40,
  },

  helpers: {
    // stuckThreshold — суммарных валидных позиций трея, ниже которых подсказка
    // уместна (затык). Черновое значение, балансируется без кода.
    hint: { unlockLevel:  5, stuckThreshold: 12 },
    swap: { unlockLevel: 12 },
  },

  nightHour: 22,

  blink: { minMs: 2200, maxMs: 6000 },

  actions: ACTIONS,

  rewards: REWARDS,
};

/**
 * XP, необходимое для перехода с уровня `level` на следующий.
 * Строго возрастающая функция; xpToNext(1) === 80.
 */
export function xpToNext(level: number): number {
  return Math.round(80 * Math.pow(1.18, level - 1));
}
