import { rngNext } from '@/core/engine';
import type { HelperId } from '@/features/progression';

import { DAILY_CONFIG, type DailyConfig } from './config';

export type DailyDrop =
  | { type: 'helperCharge'; helper: HelperId }
  | { type: 'cosmetic'; id: string }
  | { type: 'rare'; id: string }
  | null;

export interface DailyResult {
  points: number;
  multiplier: number;
  drop: DailyDrop;
  rngState: number;
}

export interface DailyPreview {
  /** День стрика, ограниченный потолком (1..len). */
  day: number;
  multiplier: number;
  points: number;
}

/**
 * Превью награды дня для UI (без расхода rng): день/множитель/бонус-очки.
 * Дроп не предсказывается — он определяется только в момент claim().
 */
export function dailyPreview(streakCount: number, cfg: DailyConfig = DAILY_CONFIG): DailyPreview {
  const day = Math.min(Math.max(streakCount, 1), cfg.streakMultiplier.length);
  const multiplier = cfg.streakMultiplier[day - 1];
  return { day, multiplier, points: Math.round(cfg.basePoints * multiplier) };
}

function pick<T>(arr: readonly T[], r: number): T {
  return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
}

/**
 * Детерминированный расчёт награды дня по дню стрика и состоянию rng.
 * points = base × множитель(стрик); сверх — шанс на дроп (helperCharge | cosmetic | rare);
 * на стрике, кратном 7, косметика гарантирована.
 */
export function computeDaily(
  streakCount: number,
  rngState: number,
  cfg: DailyConfig = DAILY_CONFIG,
): DailyResult {
  const dayIdx = Math.min(Math.max(streakCount, 1), cfg.streakMultiplier.length) - 1;
  const multiplier = cfg.streakMultiplier[dayIdx];
  const points = Math.round(cfg.basePoints * multiplier);

  if (
    cfg.day7GuaranteedCosmetic &&
    streakCount > 0 &&
    streakCount % 7 === 0 &&
    cfg.dailyCosmeticPool.length > 0
  ) {
    const r = rngNext(rngState);
    return { points, multiplier, drop: { type: 'cosmetic', id: pick(cfg.dailyCosmeticPool, r.value) }, rngState: r.state };
  }

  const dropChance = cfg.dropChanceByStreak[Math.min(dayIdx, cfg.dropChanceByStreak.length - 1)];
  const roll = rngNext(rngState);
  if (roll.value >= dropChance) {
    return { points, multiplier, drop: null, rngState: roll.state };
  }

  const rarity = rngNext(roll.state);
  const { helperCharge, cosmetic } = cfg.dropRarity;

  if (rarity.value < helperCharge && cfg.helperIds.length > 0) {
    const p = rngNext(rarity.state);
    return { points, multiplier, drop: { type: 'helperCharge', helper: pick(cfg.helperIds, p.value) }, rngState: p.state };
  }
  if (rarity.value < helperCharge + cosmetic && cfg.dailyCosmeticPool.length > 0) {
    const p = rngNext(rarity.state);
    return { points, multiplier, drop: { type: 'cosmetic', id: pick(cfg.dailyCosmeticPool, p.value) }, rngState: p.state };
  }
  if (cfg.rarePool.length > 0) {
    const p = rngNext(rarity.state);
    return { points, multiplier, drop: { type: 'rare', id: pick(cfg.rarePool, p.value) }, rngState: p.state };
  }

  return { points, multiplier, drop: null, rngState: rarity.state };
}
