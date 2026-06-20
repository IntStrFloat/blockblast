import { useProgression, resolveLifetimePoints } from '../store';
import { thresholdForLevel } from '../logic/levels';

function reset() {
  useProgression.setState({
    lifetimePoints: 0,
    level: 1,
    world: 1,
    unlockedThemes: ['classic'],
    activeTheme: 'classic',
    claimedRewards: [],
  });
}

describe('useProgression.addPoints', () => {
  beforeEach(reset);

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
