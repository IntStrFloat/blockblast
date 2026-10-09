import {
  ADVENTURE_XP_REWARDS,
  adventureCompletionIdentity,
  adventureRewardStage,
  adventureXpForLevel,
} from '../logic/xp';

describe('Adventure XP', () => {
  it('uses a stable first-clear amount and a bounded milestone bonus', () => {
    expect(adventureXpForLevel(0)).toBe(500);
    expect(adventureXpForLevel(5)).toBe(650);
  });

  it('publishes an explicit four-stage standard/milestone reward table', () => {
    expect(ADVENTURE_XP_REWARDS).toEqual([
      { stage: 1, levelFrom: 1, levelTo: 24, standard: 500, milestone: 650 },
      { stage: 2, levelFrom: 25, levelTo: 48, standard: 500, milestone: 650 },
      { stage: 3, levelFrom: 49, levelTo: 72, standard: 500, milestone: 650 },
      { stage: 4, levelFrom: 73, levelTo: 96, standard: 500, milestone: 650 },
    ]);
    expect(adventureRewardStage(0)).toBe(1);
    expect(adventureRewardStage(95)).toBe(4);
  });

  it('identifies the personal campaign level independently of attempt/run', () => {
    expect(adventureCompletionIdentity(2, 3)).toEqual({
      completionId: 'adventure:personal:s2:l4',
      campaign: 'personal',
      seasonId: 2,
      levelIndex: 3,
    });
  });
});
