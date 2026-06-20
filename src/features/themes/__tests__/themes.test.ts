import { PROGRESSION_CONFIG, useProgression } from '@/features/progression';

import { WORLD_THEMES, getWorldTheme } from '../catalog';
import { activeWorldTheme, setActiveWorldTheme, unlockedWorldThemes } from '../store';

describe('каталог тем', () => {
  it('у каждого worldThemeId есть тема в каталоге', () => {
    for (const id of Object.values(PROGRESSION_CONFIG.worldThemeId)) {
      expect(WORLD_THEMES.some((t) => t.id === id)).toBe(true);
    }
  });

  it('у каждой темы валидная палитра из 6 цветов', () => {
    for (const t of WORLD_THEMES) {
      expect(t.cellColors).toHaveLength(6);
      expect(t.juiceColors.length).toBeGreaterThan(0);
    }
  });

  it('неизвестный id → дефолтная тема (classic)', () => {
    expect(getWorldTheme('nope').id).toBe('classic');
  });
});

describe('выбор темы через progression', () => {
  beforeEach(() => {
    useProgression.setState({
      lifetimePoints: 0,
      level: 1,
      world: 1,
      unlockedThemes: ['classic', 'neon'],
      activeTheme: 'classic',
      claimedRewards: [],
    });
  });

  it('активная тема читается из progression', () => {
    expect(activeWorldTheme().id).toBe('classic');
  });

  it('открытые темы маппятся из progression.unlockedThemes', () => {
    expect(unlockedWorldThemes().map((t) => t.id)).toEqual(['classic', 'neon']);
  });

  it('переключение только на открытую тему', () => {
    setActiveWorldTheme('neon');
    expect(useProgression.getState().activeTheme).toBe('neon');
    setActiveWorldTheme('galaxy'); // закрыта
    expect(useProgression.getState().activeTheme).toBe('neon');
  });
});
