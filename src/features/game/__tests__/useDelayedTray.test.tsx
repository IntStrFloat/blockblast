import { SHAPES_BY_ID, type PieceInstance, type PlacementEvent } from '@/core/engine';

import { committedTrayFor, trayRefillDelayMs } from '../animation/useDelayedTray';

const dot = SHAPES_BY_ID.get('dot')!;

function event(overrides: Partial<PlacementEvent> = {}): PlacementEvent {
  return {
    placed: [[0, 0]],
    colorId: 1,
    clearedRows: [0],
    clearedCols: [],
    clearedCells: [[0, 0]],
    clearedColors: [1],
    scoreDelta: 10,
    score: 10,
    combo: 1,
    praise: 'good',
    onFire: false,
    boardCleared: false,
    newTray: true,
    gameOver: false,
    ...overrides,
  };
}

function piece(): PieceInstance {
  return { shape: dot, colorId: 1 };
}

describe('useDelayedTray', () => {
  it('never adds an input delay for last-piece clears', () => {
    expect(trayRefillDelayMs(event())).toBe(0);
    expect(trayRefillDelayMs(event({ clearedRows: [0, 1], combo: 2 }))).toBe(0);
  });

  it('returns the committed next tray while clear effects continue independently', () => {
    const nextTray = [piece(), piece(), piece()];
    expect(committedTrayFor(nextTray)).toBe(nextTray);
  });
});
