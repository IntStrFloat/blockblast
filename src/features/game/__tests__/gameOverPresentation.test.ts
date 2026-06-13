import type { PlacementEvent } from '@/core/engine';

import { gameOverPresentationFor } from '../gameOverPresentation';

const gameOverEvent = { gameOver: true } as PlacementEvent;

describe('gameOverPresentationFor', () => {
  it('marks a fresh Game Over for one-time side effects and delayed reveal', () => {
    expect(gameOverPresentationFor('over', gameOverEvent)).toEqual({
      visible: true,
      fresh: true,
      revealDelayMs: 800,
    });
  });

  it('shows a restored terminal result immediately without replay side effects', () => {
    expect(gameOverPresentationFor('over', null)).toEqual({
      visible: true,
      fresh: false,
      revealDelayMs: 0,
    });
  });

  it('hides the overlay while playing', () => {
    expect(gameOverPresentationFor('playing', gameOverEvent)).toEqual({
      visible: false,
      fresh: false,
      revealDelayMs: 0,
    });
  });
});
