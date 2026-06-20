import type { ActionId, EmoteId, Stage } from './types';

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

export interface MascotConfigType {
  helpers: {
    /** Эвристика «затыка» для подсказки; разлок помощников — из progression (спека 15 §3). */
    hint: { stuckThreshold: number };
  };
  nightHour: number;
  /**
   * Моргание управляется отдельным интервал-таймером.
   * Планировщик поведения (behavior.ts) ОБЯЗАН исключать 'blink' из пула nextAction.
   */
  blink: { minMs: number; maxMs: number };
  actions: ActionSpec[];
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

export const MASCOT_CONFIG: MascotConfigType = {
  helpers: {
    // stuckThreshold — суммарных валидных позиций трея, ниже которых подсказка
    // уместна (затык). Черновое значение, балансируется без кода.
    hint: { stuckThreshold: 12 },
  },

  nightHour: 22,

  blink: { minMs: 2200, maxMs: 6000 },

  actions: ACTIONS,
};
