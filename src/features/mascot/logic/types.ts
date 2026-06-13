/** Стадии эволюции маскота */
export type Stage = 1 | 2 | 3 | 4;

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

/** Награда за достижение уровня */
export interface LevelReward {
  kind: 'cosmetic' | 'helper' | 'stage';
  id: string;
}

/** Элемент каталога косметики */
export interface Cosmetic {
  id: string;
  slot: Slot;
  minStage: Stage;
}

/** Производная информация об уровне/прогрессе (для UI) */
export interface ProgressInfo {
  level: number;
  stage: Stage;
  xpInLevel: number;
  xpToNext: number;
}

/** Персистентное состояние маскота */
export interface MascotState {
  totalXp: number;
  level: number;
  unlocked: string[];
  equipped: Partial<Record<Slot, string>>;
  lastFedDay: string | null;
  helpersUsedDay: Partial<Record<HelperId, string>>;
  lost: boolean;
  introDone: boolean;
  rngState: number;
}
