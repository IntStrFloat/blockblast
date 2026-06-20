import { PROGRESSION_CONFIG, type ProgressionConfig } from './config';
import { levelForPoints } from './levels';
import { rewardForLevel } from './rewards';
import { worldForLevel, nextWorldLevel } from './worlds';

export type NodeKind = 'world' | 'cosmetic' | 'helper' | 'empty';
export type NodeState = 'done' | 'current' | 'locked';

export interface MapNode {
  level: number;
  kind: NodeKind;
  state: NodeState;
  /** Для kind==='world' — id темы этого мира. */
  themeId?: string;
  /** Для cosmetic/helper — id награды. */
  rewardId?: string;
  /** Тонировка «приближающегося мира» на отрезке от текущего уровня до ближайшего мира. */
  approachingThemeId?: string;
}

/**
 * Узлы дороги достижений в окне [fromLevel, toLevel] (включительно), для виртуализации.
 * Текущая позиция выводится из накопленных очков.
 */
export function deriveMapNodes(
  lifetimePoints: number,
  fromLevel: number,
  toLevel: number,
  cfg: ProgressionConfig = PROGRESSION_CONFIG,
): MapNode[] {
  const current = levelForPoints(lifetimePoints, cfg);
  const upcoming = nextWorldLevel(current, cfg);
  const upcomingThemeId =
    upcoming !== null ? cfg.worldThemeId[worldForLevel(upcoming, cfg)] : undefined;

  const start = Math.max(1, Math.floor(fromLevel));
  const end = Math.max(start, Math.floor(toLevel));
  const nodes: MapNode[] = [];

  for (let L = start; L <= end; L++) {
    const reward = rewardForLevel(L, cfg);
    const kind: NodeKind =
      reward === null
        ? 'empty'
        : reward.kind === 'world'
          ? 'world'
          : reward.kind === 'cosmetic'
            ? 'cosmetic'
            : 'helper';

    const state: NodeState = L < current ? 'done' : L === current ? 'current' : 'locked';

    const node: MapNode = { level: L, kind, state };
    if (reward !== null && reward.kind === 'world') node.themeId = reward.themeId;
    if (reward !== null && (reward.kind === 'cosmetic' || reward.kind === 'helper')) {
      node.rewardId = reward.id;
    }
    if (upcoming !== null && upcomingThemeId !== undefined && L > current && L <= upcoming) {
      node.approachingThemeId = upcomingThemeId;
    }

    nodes.push(node);
  }

  return nodes;
}
