import { applyPlacement, findPlacements } from '@/core/engine/board';
import { SHAPES_BY_ID } from '@/core/engine/shapes';
import { place } from '@/core/engine/game';

import {
  createTutorialGame,
  findTutorialRecommendation,
  isTutorialRecommendationValid,
  withTutorialRecoveryPiece,
} from '../tutorialGame';

describe('curated tutorial opening', () => {
  it('starts with the original-style cross board and one blue square piece', () => {
    const game = createTutorialGame(42);
    expect(game.status).toBe('playing');
    expect(game.tray).toHaveLength(3);
    expect(game.tray[0]).toBeNull();
    expect(game.tray[1]).toBeNull();
    expect(game.tray[2]?.shape.id).toBe('sq2');
    expect(findPlacements(game.board, game.tray[2]!.shape)).toContainEqual([3, 3]);
  });

  it('offers a valid recommendation that clears in at most three placements', () => {
    let game = createTutorialGame(42);
    let placements = 0;

    while (placements < 3) {
      const recommendation = findTutorialRecommendation(game);
      expect(recommendation).not.toBeNull();
      expect(isTutorialRecommendationValid(game, recommendation!)).toBe(true);
      expect(recommendation!.placementsToClear).toBeLessThanOrEqual(3 - placements);

      const result = place(
        game,
        recommendation!.trayIndex,
        recommendation!.row,
        recommendation!.col,
      );
      placements += 1;
      if (result.event.clearedRows.length + result.event.clearedCols.length > 0) {
        expect(placements).toBeLessThanOrEqual(3);
        return;
      }
      game = result.state;
    }
    throw new Error('The curated recommendation did not clear a line');
  });

  it('recommends the center pocket as the first and only tutorial move', () => {
    const game = createTutorialGame(42);
    const recommendation = findTutorialRecommendation(game)!;
    expect(recommendation.trayIndex).toBe(2);
    expect(recommendation.row).toBe(3);
    expect(recommendation.col).toBe(3);
    expect(recommendation.placementsToClear).toBe(1);
    expect(isTutorialRecommendationValid(game, recommendation)).toBe(true);
  });

  it('puts a player-placeable recovery piece in the next tray without auto-placement', () => {
    const game = createTutorialGame(42);
    const dot = SHAPES_BY_ID.get('dot')!;
    const h2 = SHAPES_BY_ID.get('h2')!;
    let board = applyPlacement(game.board, dot, 0, 0, 1).board;
    board = applyPlacement(board, dot, 0, 1, 2).board;
    board = applyPlacement(board, h2, 0, 2, 3).board;

    const fallbackTray = [
      { shape: h2, colorId: 1 },
      { shape: h2, colorId: 2 },
      { shape: h2, colorId: 3 },
    ];
    const recovered = withTutorialRecoveryPiece(board, fallbackTray);
    expect(recovered).not.toBeNull();
    expect(isTutorialRecommendationValid({ board, tray: recovered!.tray }, recovered!.recommendation)).toBe(true);
    expect(recovered!.recommendation.placementsToClear).toBe(1);
  });
});
