import { useProgression } from '../store';
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
