import { PROGRESSION_CONFIG, type ProgressionConfig } from './config';

export function worldStartLevels(cfg: ProgressionConfig = PROGRESSION_CONFIG): number[] {
  const starts = [1];
  let level = 1;
  for (const gap of cfg.tierGaps) {
    level += gap;
    starts.push(level);
  }
  return starts;
}

export function worldForLevel(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  const L = Math.max(1, Math.floor(level));
  const starts = worldStartLevels(cfg);
  let world = 1;
  for (let i = 0; i < starts.length; i++) {
    if (L >= starts[i]) world = i + 1;
    else break;
  }
  return world;
}

export function isWorldStart(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): boolean {
  return worldStartLevels(cfg).includes(Math.floor(level));
}

export function nextWorldLevel(
  level: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): number | null {
  const L = Math.floor(level);
  for (const s of worldStartLevels(cfg)) {
    if (s > L) return s;
  }
  return null;
}
