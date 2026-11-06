import type { AdventureLevelSpec, AdventureObjective } from '@/core/engine';

import { ADVENTURE_CONFIG } from './config';
import { prefillFor } from './layouts';

export interface AdventureLevelMeta extends AdventureLevelSpec {
  milestone: boolean;
}

export function isMilestone(levelIndex: number): boolean {
  return levelIndex + 1 === ADVENTURE_CONFIG.seasonTileCount || (levelIndex + 1) % ADVENTURE_CONFIG.milestoneEvery === 0;
}

function objectiveFor(levelIndex: number): AdventureObjective {
  return {
    type: 'jewels',
    target:
      9 + (levelIndex % 12) + Math.floor(levelIndex / 12) * 2 + (isMilestone(levelIndex) ? 3 : 0),
  };
}

export function levelFor(seasonId: number, levelIndex: number): AdventureLevelMeta {
  const objective = objectiveFor(levelIndex);
  const boardJewels =
    objective.type === 'jewels' ? Math.max(1, Math.floor(objective.target / 2)) : 0;
  return {
    id: `s${seasonId}-l${levelIndex + 1}`,
    rulesVersion: 2,
    seasonId,
    levelIndex,
    seed: ADVENTURE_CONFIG.seedBase + seasonId * 4099 + levelIndex * 97,
    objective,
    prefill: prefillFor(levelIndex, boardJewels),
    milestone: isMilestone(levelIndex),
  };
}
