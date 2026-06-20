/** Стадии эволюции маскота — выводятся из Уровня Игры (источник истины — progression, спека 15). */
export type { Stage } from '@/features/progression';
import type { Stage } from '@/features/progression';

/** Слоты косметики */
export type Slot = 'hat' | 'face' | 'accessory' | 'skin' | 'aura';

/** Эмоции-оверлеи */
export type EmoteId =
  | 'none'
  | 'heart'
  | 'sparkle'
  | 'sleep'
  | 'sweat'
  | 'note'
  | 'think'
  | 'excl'
  | 'fire';

/** Настроение маскота */
export type Mood = 'happy' | 'neutral' | 'sad';

/** Идентификаторы помощников */
export type HelperId = 'hint' | 'swap';

/** Все 28 анимационных действий маскота */
export type ActionId =
  | 'walkLeft'
  | 'walkRight'
  | 'idle'
  | 'sit'
  | 'lieDown'
  | 'sleep'
  | 'yawn'
  | 'stretch'
  | 'scratch'
  | 'lookScore'
  | 'lookBoard'
  | 'lookPlayer'
  | 'wave'
  | 'balanceBlock'
  | 'rollBlock'
  | 'pushBlock'
  | 'peekDown'
  | 'sniff'
  | 'groom'
  | 'dance'
  | 'spin'
  | 'hop'
  | 'ponder'
  | 'sparkleIdle'
  | 'sneeze'
  | 'wobble'
  | 'faceplant'
  | 'blink';

/** Одно действие в поведенческом планировщике */
export interface BehaviorAction {
  id: ActionId;
  durationMs: number;
  dir?: -1 | 1;
  emote?: EmoteId;
}

/** Контекст для выбора поведения */
export interface BehaviorCtx {
  stage: Stage;
  hourOfDay: number;
  reduceMotion: boolean;
  mood: Mood;
}

/** Элемент каталога косметики */
export interface Cosmetic {
  id: string;
  slot: Slot;
  minStage: Stage;
}

/**
 * Персистентное состояние маскота (спека 15 §2). Капи — спутник-витрина:
 * собственной XP/уровня нет (живут в progression.lifetimePoints/level), кормления-XP нет
 * (дейли владеет забором). Маскот хранит только гардероб, помощников, потерю, интро и rng.
 */
export interface MascotState {
  unlocked: string[];
  equipped: Partial<Record<Slot, string>>;
  helpersUsedDay: Partial<Record<HelperId, string>>;
  /** Доп. заряды помощников (из дроп-дейли), тратятся сверх дневного лимита. */
  helperCharges: Partial<Record<HelperId, number>>;
  lost: boolean;
  introDone: boolean;
  rngState: number;
}
