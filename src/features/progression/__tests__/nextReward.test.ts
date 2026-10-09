import { nextRewardInCurrentWorld, nextRewardMilestone } from '../logic/rewards';

describe('progression reward milestones', () => {
  it('returns the immediately available first cosmetic for a new player', () => {
    expect(nextRewardInCurrentWorld(0)).toMatchObject({
      level: 1,
      threshold: 0,
      remaining: 0,
      available: true,
      reward: { kind: 'cosmetic', id: 'hat-casquette' },
    });
  });

  it('reports a concrete remaining amount to the next reward', () => {
    expect(nextRewardInCurrentWorld(1_000)).toMatchObject({
      level: 2,
      threshold: 2_000,
      remaining: 1_000,
      reward: { kind: 'helper', id: 'hint' },
    });
  });

  it('falls back when every reward in the current world is already open', () => {
    expect(nextRewardInCurrentWorld(5_501)).toBeNull();
    expect(nextRewardMilestone(5_501)).toMatchObject({ level: 4, reward: { kind: 'world' } });
  });
});
