import { useAnalyticsStore } from '@/features/analytics';
import { KEYS, getJSON, removeKey, storage } from '@/core/storage';

import { useProgression, resolveLifetimePoints } from '../store';
import { thresholdForLevel } from '../logic/levels';

function reset() {
  removeKey(KEYS.progression);
  useProgression.setState({
    lifetimePoints: 0,
    level: 1,
    world: 1,
    unlockedThemes: ['classic'],
    activeTheme: 'classic',
    claimedRewards: [],
    appliedSettlements: [],
    rewardReceipts: {},
  });
  useAnalyticsStore.setState({ queue: [], optOut: false });
}

describe('useProgression.addPoints', () => {
  beforeEach(reset);

  it('applies a persisted run settlement only once', () => {
    expect(useProgression.getState().addPointsOnce('run-1', 500).applied).toBe(true);
    expect(useProgression.getState().addPointsOnce('run-1', 500).applied).toBe(false);
    expect(useProgression.getState().lifetimePoints).toBe(500);
  });

  it('stores balance and cumulative receipt atomically and grants only a higher target delta', () => {
    const first = useProgression.getState().grantReward({
      runId: 'classic-1', rewardId: 'xp', source: 'classic', targetAmount: 1_000,
    });
    const improved = useProgression.getState().grantReward({
      runId: 'classic-1', rewardId: 'xp', source: 'classic', targetAmount: 1_500,
    });
    const duplicate = useProgression.getState().grantReward({
      runId: 'classic-1', rewardId: 'xp', source: 'classic', targetAmount: 1_500,
    });

    expect(first.grantedDelta).toBe(1_000);
    expect(improved.grantedDelta).toBe(500);
    expect(duplicate.grantedDelta).toBe(0);
    expect(useProgression.getState().lifetimePoints).toBe(1_500);
    expect(getJSON<{ lifetimePoints: number; rewardReceipts: Record<string, { grantedAmount: number }> }>(KEYS.progression))
      .toMatchObject({
        lifetimePoints: 1_500,
        rewardReceipts: { 'classic-1::xp': { grantedAmount: 1_500 } },
      });
  });

  it.each(['adventure', 'weekly'] as const)(
    'supports %s XP through the same run/reward receipt contract',
    (source) => {
      const result = useProgression.getState().grantReward({
        runId: `${source}-run`, rewardId: 'xp', source, targetAmount: 75,
      });
      expect(result.grantedDelta).toBe(75);
      expect(result.receipt.source).toBe(source);
    },
  );

  it('conservatively locks a legacy applied settlement without replaying historical XP', () => {
    useProgression.setState({ lifetimePoints: 2_000, appliedSettlements: ['classic:old-run'] });
    const result = useProgression.getState().grantReward({
      runId: 'old-run', rewardId: 'xp', source: 'classic', targetAmount: 900,
    });

    expect(result.grantedDelta).toBe(0);
    expect(useProgression.getState().lifetimePoints).toBe(2_000);
    expect(useProgression.getState().rewardReceipts['old-run::xp'].grantedAmount).toBe(900);
  });

  it('does not expose balance or receipt when the commit-critical write fails', () => {
    const write = jest.spyOn(storage, 'set').mockImplementationOnce(() => {
      throw new Error('disk unavailable');
    });

    expect(() => useProgression.getState().grantReward({
      runId: 'run-fail', rewardId: 'xp', source: 'classic', targetAmount: 500,
    })).toThrow('disk unavailable');
    expect(useProgression.getState().lifetimePoints).toBe(0);
    expect(useProgression.getState().rewardReceipts).toEqual({});
    write.mockRestore();
  });

  it('накопление поднимает уровень и отдаёт награды диапазона', () => {
    const res = useProgression.getState().addPoints(thresholdForLevel(6));
    expect(res.fromLevel).toBe(1);
    expect(res.toLevel).toBe(6);
    expect(res.enteredWorld).toBe(2);
    expect(res.rewards).toContainEqual({ kind: 'world', world: 2, themeId: 'neon', evolveStage: 2 });
    const s = useProgression.getState();
    expect(s.world).toBe(2);
    expect(s.unlockedThemes).toEqual(['classic', 'neon']);
    expect(s.activeTheme).toBe('neon');
    // level-1 reward is the coordinator's job at mount; addPoints covers crossed range (L2..L6)
    expect(s.claimedRewards).toContain('acc-headphones');
  });

  it('без смены уровня enteredWorld = null, rewards пуст', () => {
    const res = useProgression.getState().addPoints(10);
    expect(res.fromLevel).toBe(1);
    expect(res.toLevel).toBe(1);
    expect(res.enteredWorld).toBeNull();
    expect(res.rewards).toEqual([]);
  });

  it('отрицательное прибавление клампится к 0', () => {
    useProgression.getState().addPoints(-50);
    expect(useProgression.getState().lifetimePoints).toBe(0);
  });

  it('рост уровня трекает level_up, вход в мир — world_unlocked', () => {
    useProgression.getState().addPoints(thresholdForLevel(4));
    const names = useAnalyticsStore.getState().queue.map((e) => e.name);
    expect(names).toContain('level_up');
    expect(names).toContain('world_unlocked');
    expect(useAnalyticsStore.getState().queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'level_up', properties: { level: 4, world: 2 } }),
        expect.objectContaining({ name: 'world_unlocked', properties: { world: 2 } }),
      ]),
    );
  });

  it('без смены уровня события не трекаются', () => {
    useProgression.getState().addPoints(10);
    expect(useAnalyticsStore.getState().queue).toEqual([]);
  });
});

describe('useProgression.setActiveTheme', () => {
  beforeEach(reset);

  it('переключает только на открытую тему', () => {
    useProgression.setState({ unlockedThemes: ['classic', 'neon'] });
    useProgression.getState().setActiveTheme('neon');
    expect(useProgression.getState().activeTheme).toBe('neon');
    useProgression.getState().setActiveTheme('galaxy');
    expect(useProgression.getState().activeTheme).toBe('neon');
  });
});

describe('resolveLifetimePoints (миграция)', () => {
  it('сохранённый прогресс приоритетнее старой XP Капи', () => {
    expect(resolveLifetimePoints({ lifetimePoints: 1234 }, { totalXp: 9999 })).toBe(1234);
  });

  it('мигрирует из mascot.totalXp при отсутствии прогресса', () => {
    expect(resolveLifetimePoints(null, { totalXp: 5000 })).toBe(5000);
  });

  it('ноль, если нет ни прогресса, ни маскота', () => {
    expect(resolveLifetimePoints(null, null)).toBe(0);
  });

  it('клампит отрицательное к 0', () => {
    expect(resolveLifetimePoints({ lifetimePoints: -10 }, null)).toBe(0);
  });
});
