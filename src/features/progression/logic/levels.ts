import { PROGRESSION_CONFIG, type ProgressionConfig } from './config';
import { worldForLevel } from './worlds';
import type { ProgressInfo } from './types';

export function levelCost(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  const L = Math.max(1, Math.floor(level));
  return Math.round(cfg.levelCost.base * Math.pow(cfg.levelCost.growth, L - 1));
}

export function thresholdForLevel(
  level: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): number {
  const L = Math.max(1, Math.floor(level));
  let sum = 0;
  for (let i = 1; i < L; i++) sum += levelCost(i, cfg);
  return sum;
}

export function levelForPoints(points: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  let level = 1;
  let remaining = Math.max(0, points);
  while (remaining >= levelCost(level, cfg)) {
    remaining -= levelCost(level, cfg);
    level += 1;
  }
  return level;
}

export function progressFor(points: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): ProgressInfo {
  let level = 1;
  let remaining = Math.max(0, points);
  while (remaining >= levelCost(level, cfg)) {
    remaining -= levelCost(level, cfg);
    level += 1;
  }
  return {
    level,
    world: worldForLevel(level, cfg),
    pointsInLevel: remaining,
    pointsToNext: levelCost(level, cfg) - remaining,
  };
}
