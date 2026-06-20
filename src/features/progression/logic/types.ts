export type Stage = 1 | 2 | 3 | 4;
export type HelperId = 'hint' | 'swap';

export interface RewardCosmetic {
  kind: 'cosmetic';
  id: string;
}
export interface RewardHelper {
  kind: 'helper';
  id: HelperId;
}
export interface RewardWorld {
  kind: 'world';
  world: number;
  themeId: string;
  evolveStage?: Stage;
}
export type LevelReward = RewardCosmetic | RewardHelper | RewardWorld;

export interface ProgressInfo {
  level: number;
  world: number;
  pointsInLevel: number;
  pointsToNext: number;
}
