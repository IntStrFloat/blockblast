import type { AdventureLevelSpec, AdventureObjective } from '@/core/engine';

import { ADVENTURE_CONFIG } from './config';
import { prefillFor } from './layouts';

export interface AdventureLevelMeta extends AdventureLevelSpec {
  milestone: boolean;
}

export function isMilestone(levelIndex: number): boolean {
  return (levelIndex + 1) % ADVENTURE_CONFIG.milestoneEvery === 0;
}

function objectiveFor(levelIndex: number): AdventureObjective {
  const milestone = isMilestone(levelIndex);
  if (
    levelIndex >= ADVENTURE_CONFIG.jewelStartLevel &&
    (milestone || (levelIndex - ADVENTURE_CONFIG.jewelStartLevel) % ADVENTURE_CONFIG.jewelEveryLevels === 0)
  ) {
    return {
      type: 'jewels',
      target: ADVENTURE_CONFIG.jewelBaseTarget + Math.floor(levelIndex / 12) + (milestone ? 1 : 0),
    };
  }

  const rawTarget = ADVENTURE_CONFIG.scoreBaseTarget + levelIndex * ADVENTURE_CONFIG.scoreStep;
  return {
    type: 'score',
    target: Math.round(rawTarget * (milestone ? ADVENTURE_CONFIG.scoreMilestoneMultiplier : 1)),
  };
}

export function levelFor(seasonId: number, levelIndex: number): AdventureLevelMeta {
  const objective = objectiveFor(levelIndex);
  const boardJewels = objective.type === 'jewels' ? Math.max(1, Math.floor(objective.target / 2)) : 0;
  return {
    id: `s${seasonId}-l${levelIndex + 1}`,
    seasonId,
    levelIndex,
    seed: ADVENTURE_CONFIG.seedBase + seasonId * 4099 + levelIndex * 97,
    objective,
    prefill: prefillFor(levelIndex, boardJewels),
    milestone: isMilestone(levelIndex),
  };
}
