import type { HelperId } from '@/features/progression';

export interface DailyConfig {
  /** База бонус-очков (≈ половина медианной партии). */
  basePoints: number;
  /** Множитель по дню стрика (1..7+), последний — потолок. */
  streakMultiplier: number[];
  /** Шанс самого дропа по дню стрика. */
  dropChanceByStreak: number[];
  /** Доли типов внутри дропа (сумма = 1). */
  dropRarity: { helperCharge: number; cosmetic: number; rare: number };
  /** Гарантировать косметику на стрике, кратном 7. */
  day7GuaranteedCosmetic: boolean;
  /** Период восстановления защитника стрика (дней). */
  protectorPerDays: number;
  /** Дневной пул косметики (id из mascot/cosmetics.ts, не пересекается с PROGRESSION_CONFIG.levelRewards). */
  dailyCosmeticPool: string[];
  /** Редкие скины Капи (id из mascot/cosmetics.ts). */
  rarePool: string[];
  /** Помощники, заряд которых может выпасть. */
  helperIds: HelperId[];
}

export const DAILY_CONFIG: DailyConfig = {
  basePoints: 500,
  streakMultiplier: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
  dropChanceByStreak: [0.25, 0.28, 0.31, 0.35, 0.39, 0.42, 0.45],
  dropRarity: { helperCharge: 0.6, cosmetic: 0.3, rare: 0.1 },
  day7GuaranteedCosmetic: true,
  protectorPerDays: 7,
  dailyCosmeticPool: ['hat-block-crown', 'face-monocle', 'skin-chrome', 'acc-cape'],
  rarePool: ['hat-halo'],
  helperIds: ['hint', 'swap'],
};
