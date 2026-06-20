import { deriveMapNodes } from '../logic/map';
import { thresholdForLevel } from '../logic/levels';

describe('deriveMapNodes', () => {
  const points = thresholdForLevel(8); // текущий уровень 8 (мир 2)
  const nodes = deriveMapNodes(points, 5, 14);
  const at = (level: number) => nodes.find((n) => n.level === level)!;

  it('окно [5..14] возвращает узлы по уровням', () => {
    expect(nodes.map((n) => n.level)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('состояния done/current/locked относительно текущего уровня', () => {
    expect(at(7).state).toBe('done');
    expect(at(8).state).toBe('current');
    expect(at(9).state).toBe('locked');
  });

  it('узел мира несёт themeId', () => {
    expect(at(6).kind).toBe('world');
    expect(at(6).themeId).toBe('neon');
    expect(at(13).kind).toBe('world');
    expect(at(13).themeId).toBe('sunset');
  });

  it('косметика/помощник несут rewardId, пустые — empty', () => {
    expect(at(8).kind).toBe('cosmetic');
    expect(at(8).rewardId).toBe('skin-mint');
    expect(at(9).kind).toBe('helper');
    expect(at(9).rewardId).toBe('swap');
    expect(at(7).kind).toBe('empty');
  });

  it('приближающийся мир тонирует отрезок от текущего до ближайшего мира (13)', () => {
    expect(at(8).approachingThemeId).toBeUndefined(); // текущий — не тонируем
    expect(at(9).approachingThemeId).toBe('sunset');
    expect(at(13).approachingThemeId).toBe('sunset');
    expect(at(14).approachingThemeId).toBeUndefined(); // за ближайшим миром — нет
  });
});
