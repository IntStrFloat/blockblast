import { worldStartLevels, worldForLevel, isWorldStart, nextWorldLevel } from '../logic/worlds';

describe('worldStartLevels', () => {
  it('из tierGaps [5,7,9,11,14,18,22] → [1,6,13,22,33,47,65,87]', () => {
    expect(worldStartLevels()).toEqual([1, 6, 13, 22, 33, 47, 65, 87]);
  });
});

describe('worldForLevel', () => {
  it('границы миров', () => {
    expect(worldForLevel(1)).toBe(1);
    expect(worldForLevel(5)).toBe(1);
    expect(worldForLevel(6)).toBe(2);
    expect(worldForLevel(12)).toBe(2);
    expect(worldForLevel(13)).toBe(3);
    expect(worldForLevel(22)).toBe(4);
  });
  it('ниже 1 → мир 1', () => {
    expect(worldForLevel(0)).toBe(1);
  });
});

describe('isWorldStart', () => {
  it('true на старте мира, false внутри', () => {
    expect(isWorldStart(6)).toBe(true);
    expect(isWorldStart(13)).toBe(true);
    expect(isWorldStart(7)).toBe(false);
  });
});

describe('nextWorldLevel', () => {
  it('следующий мировой уровень', () => {
    expect(nextWorldLevel(1)).toBe(6);
    expect(nextWorldLevel(6)).toBe(13);
    expect(nextWorldLevel(12)).toBe(13);
  });
  it('за последним миром → null', () => {
    expect(nextWorldLevel(999)).toBeNull();
  });
});
