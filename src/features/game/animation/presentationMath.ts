export type Cell = readonly [number, number];

export interface CellGeometry {
  boardSize: number;
  cell: number;
  gap: number;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function centroid(cells: readonly Cell[], geom: CellGeometry) {
  if (cells.length === 0) {
    return { x: geom.boardSize / 2, y: geom.boardSize / 2 };
  }
  const step = geom.cell + geom.gap;
  const sum = cells.reduce(
    (acc, [row, col]) => ({
      x: acc.x + col * step + geom.cell / 2,
      y: acc.y + row * step + geom.cell / 2,
    }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / cells.length, y: sum.y / cells.length };
}

export function createSeedHasher(seed = 2166136261) {
  let hash = seed >>> 0;

  const feedNumber = (value: number) => {
    hash ^= value | 0;
    hash = Math.imul(hash, 16777619);
  };

  const feedString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      feedNumber(value.charCodeAt(index));
    }
  };

  return {
    feedNumber,
    feedString,
    value() {
      return hash >>> 0 || 1;
    },
  };
}
