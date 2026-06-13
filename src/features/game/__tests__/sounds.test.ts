import type { PlacementEvent } from '@/core/engine';

import { soundForPlacement } from '../sound/soundEvents';

function event(overrides: Partial<PlacementEvent> = {}): PlacementEvent {
  return {
    placed: [[0, 0]],
    colorId: 1,
    clearedRows: [],
    clearedCols: [],
    clearedCells: [],
    clearedColors: [],
    scoreDelta: 1,
    score: 1,
    combo: 0,
    praise: 'none',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
    ...overrides,
  };
}

describe('soundForPlacement', () => {
  it('maps a normal placement to drop', () => {
    expect(soundForPlacement(event())).toBe('drop');
  });

  it('maps one, two, and three lines deterministically', () => {
    expect(soundForPlacement(event({ clearedRows: [0] }))).toBe('clear1');
    expect(soundForPlacement(event({ clearedRows: [0, 1] }))).toBe('clear2');
    expect(soundForPlacement(event({ clearedRows: [0, 1, 2] }))).toBe('clear3');
  });

  it('maps a high combo clear to clear3', () => {
    expect(soundForPlacement(event({ clearedRows: [0], onFire: true, combo: 3 }))).toBe('clear3');
  });

  it('gives Game Over precedence over clear and drop', () => {
    expect(
      soundForPlacement(event({ gameOver: true, clearedRows: [0, 1], onFire: true })),
    ).toBe('gameover');
  });
});
