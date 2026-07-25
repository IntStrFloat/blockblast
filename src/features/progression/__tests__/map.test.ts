import { deriveMapNodes } from '../logic/map';
import { thresholdForLevel } from '../logic/levels';

describe('deriveMapNodes', () => {
  const points = thresholdForLevel(6); // текущий уровень 6 (мир 2: старты [1,4,8,13,...])
  const nodes = deriveMapNodes(points, 3, 10);
  const at = (level: number) => nodes.find((n) => n.level === level)!;

  it('окно [3..10] возвращает узлы по уровням', () => {
    expect(nodes.map((n) => n.level)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('состояния done/current/locked относительно текущего уровня', () => {
    expect(at(5).state).toBe('done');
    expect(at(6).state).toBe('current');
    expect(at(7).state).toBe('locked');
  });

  it('узел мира несёт themeId', () => {
    expect(at(4).kind).toBe('world');
    expect(at(4).themeId).toBe('neon');
    expect(at(8).kind).toBe('world');
    expect(at(8).themeId).toBe('sunset');
  });

  it('косметика/помощник несут rewardId, пустые — empty', () => {
    expect(at(6).kind).toBe('helper');
    expect(at(6).rewardId).toBe('swap');
    expect(at(7).kind).toBe('cosmetic');
    expect(at(7).rewardId).toBe('skin-mint');
    expect(at(10).kind).toBe('empty');
  });

  it('приближающийся мир тонирует отрезок от текущего до ближайшего мира (8)', () => {
    expect(at(6).approachingThemeId).toBeUndefined(); // текущий — не тонируем
    expect(at(7).approachingThemeId).toBe('sunset');
    expect(at(8).approachingThemeId).toBe('sunset');
    expect(at(9).approachingThemeId).toBeUndefined(); // за ближайшим миром — нет
  });
});
