import { worldStartLevels, worldForLevel, isWorldStart, nextWorldLevel } from '../logic/worlds';

describe('worldStartLevels', () => {
  it('из tierGaps [3,4,5,6,8,10] → [1,4,8,13,19,27,37] (7 миров = 7 тем)', () => {
    expect(worldStartLevels()).toEqual([1, 4, 8, 13, 19, 27, 37]);
  });
});

describe('worldForLevel', () => {
  it('границы миров', () => {
    expect(worldForLevel(1)).toBe(1);
    expect(worldForLevel(3)).toBe(1);
    expect(worldForLevel(4)).toBe(2);
    expect(worldForLevel(7)).toBe(2);
    expect(worldForLevel(8)).toBe(3);
    expect(worldForLevel(13)).toBe(4);
    expect(worldForLevel(999)).toBe(7);
  });
  it('ниже 1 → мир 1', () => {
    expect(worldForLevel(0)).toBe(1);
  });
});

describe('isWorldStart', () => {
  it('true на старте мира, false внутри', () => {
    expect(isWorldStart(4)).toBe(true);
    expect(isWorldStart(8)).toBe(true);
    expect(isWorldStart(5)).toBe(false);
  });
});

describe('nextWorldLevel', () => {
  it('следующий мировой уровень', () => {
    expect(nextWorldLevel(1)).toBe(4);
    expect(nextWorldLevel(4)).toBe(8);
    expect(nextWorldLevel(7)).toBe(8);
  });
  it('за последним миром → null', () => {
    expect(nextWorldLevel(999)).toBeNull();
  });
});
