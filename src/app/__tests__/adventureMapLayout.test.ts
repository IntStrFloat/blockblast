import { adventureMapCellPosition } from '../adventure';

describe('Adventure tower geometry', () => {
  it('gives every actual level one unique reachable node', () => {
    const positions = Array.from({ length: 96 }, (_, i) => adventureMapCellPosition(i, 358));
    expect(positions.every(Boolean)).toBe(true);
    expect(new Set(positions.map((p) => `${p!.left}:${p!.top}`)).size).toBe(96);
    expect(adventureMapCellPosition(-1, 358)).toBeNull();
    expect(adventureMapCellPosition(96, 358)).toBeNull();
  });
  it('keeps every staggered node inside narrow and wide viewports', () => {
    for (const width of [288, 358, 520]) {
      for (let index = 0; index < 96; index++) {
        const node = adventureMapCellPosition(index, width)!;
        expect(node.left).toBeGreaterThanOrEqual(0);
        expect(node.left + node.cell).toBeLessThanOrEqual(width);
      }
    }
  });
  it('preserves row spacing and proportions while scaling narrow screens', () => {
    const first = adventureMapCellPosition(0, 358)!;
    expect(adventureMapCellPosition(4, 358)!.top).toBe(first.top);
    expect(adventureMapCellPosition(5, 358)!.top).toBeLessThan(first.top - first.cell);
    const narrow = adventureMapCellPosition(5, 179)!;
    const regular = adventureMapCellPosition(5, 358)!;
    expect(narrow.cell).toBeCloseTo(regular.cell / 2);
    expect(narrow.left).toBeCloseTo(regular.left / 2);
  });
});
