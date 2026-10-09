import { ADVENTURE_CONFIG } from '../logic/config';
import { ADVENTURE_SKINS, adventureSkinFor, adventureSkinIndex } from '../logic/skins';

describe('adventure skins', () => {
  const every = ADVENTURE_CONFIG.skinEveryLevels;

  it('keeps the same skin within a block of skinEveryLevels', () => {
    for (let level = 1; level <= every; level += 1) {
      expect(adventureSkinIndex(level)).toBe(0);
    }
  });

  it('advances to the next skin every skinEveryLevels levels', () => {
    expect(adventureSkinIndex(every)).toBe(0);
    expect(adventureSkinIndex(every + 1)).toBe(1);
    expect(adventureSkinIndex(every * 2 + 1)).toBe(2);
  });

  it('cycles through the skin list without reset across seasons', () => {
    const count = ADVENTURE_SKINS.length;
    // Сквозной номер уходит за длину списка — индекс зацикливается, не сбрасывается.
    const firstOfCycle = every * count + 1;
    expect(adventureSkinIndex(firstOfCycle)).toBe(0);
    expect(adventureSkinFor(firstOfCycle)).toBe(ADVENTURE_SKINS[0]);
    expect(adventureSkinFor(firstOfCycle + every)).toBe(ADVENTURE_SKINS[1]);
  });

  it('guards against non-positive level numbers', () => {
    expect(adventureSkinIndex(0)).toBe(0);
    expect(adventureSkinIndex(-5)).toBe(0);
  });

  it('level 1 keeps the original meadow palette', () => {
    expect(adventureSkinFor(1).id).toBe('meadow');
    expect(adventureSkinFor(1).blockColor).toBe('#4DB96A');
  });

  it('changes the compact progress-bar palette with the active skin', () => {
    const meadow = adventureSkinFor(1);
    const berry = adventureSkinFor(every + 1);

    expect(meadow.progressGradient).toHaveLength(4);
    expect(meadow.progressGradient).not.toEqual(berry.progressGradient);
    expect(meadow.progressBadge).not.toBe(berry.progressBadge);
  });

  it('changes only the setting when the calendar season advances on an unfinished level', () => {
    expect(adventureSkinFor(6, { seasonId: 1 }).id).toBe('meadow');
    expect(adventureSkinFor(6, { seasonId: 2 }).id).toBe('berry');
  });

  it('keeps the calendar setting while personal level progression advances', () => {
    const window = { seasonId: 3 };
    expect(adventureSkinFor(1, window)).toBe(adventureSkinFor(97, window));
    expect(adventureSkinFor(195, window).id).toBe('cove');
  });

  it('cycles calendar settings and keeps the existing level-based fallback before sync', () => {
    expect(adventureSkinFor(17, { seasonId: ADVENTURE_SKINS.length + 1 }).id).toBe('meadow');
    expect(adventureSkinFor(every + 1, null)).toBe(adventureSkinFor(every + 1));
  });
});
