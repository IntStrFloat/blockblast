import { createAdventureRun, emptyBoard, findPlacements, SHAPES_BY_ID } from '@/core/engine';

import {
  ADVENTURE_HELP_FAILURE_THRESHOLD,
  ADVENTURE_HELP_MAX_LEVEL_INDEX,
  adventureFailurePresentation,
  findAdventureHelpMove,
  shouldOfferAdventureHelp,
} from '../logic/failure';

const scoreLevel = {
  id: 's1-l1',
  seasonId: 1,
  levelIndex: 0,
  seed: 42,
  objective: { type: 'score' as const, target: 128 },
};

describe('Adventure failure recovery presentation', () => {
  it('reports the exact score and remaining objective without promising a terminal move', () => {
    const run = createAdventureRun(scoreLevel);
    run.game = { ...run.game, score: 81, board: emptyBoard().map((_, index) => index < 40 ? 1 : 0) };

    expect(adventureFailurePresentation(run)).toEqual({
      current: 81,
      target: 128,
      remaining: 47,
      tip: 'open_space',
    });
  });

  it('reports exact jewel progress and gives a jewel-specific tip', () => {
    const run = createAdventureRun({
      ...scoreLevel,
      id: 's1-l8',
      levelIndex: 7,
      objective: { type: 'jewels', target: 7 },
    });
    run.collectedJewels = 4;

    expect(adventureFailurePresentation(run)).toEqual({
      current: 4,
      target: 7,
      remaining: 3,
      tip: 'collect_jewel_line',
    });
  });

  it('offers help only after two failures on the documented first five levels', () => {
    expect(ADVENTURE_HELP_FAILURE_THRESHOLD).toBe(2);
    expect(ADVENTURE_HELP_MAX_LEVEL_INDEX).toBe(4);
    expect(shouldOfferAdventureHelp(0, 1)).toBe(false);
    expect(shouldOfferAdventureHelp(0, 2)).toBe(true);
    expect(shouldOfferAdventureHelp(4, 2)).toBe(true);
    expect(shouldOfferAdventureHelp(5, 2)).toBe(false);
  });

  it('returns a deterministic legal highlight only on an active playable board', () => {
    const run = createAdventureRun(scoreLevel, 2);
    const first = findAdventureHelpMove(run);
    const second = findAdventureHelpMove(run);
    expect(second).toEqual(first);
    expect(first).not.toBeNull();
    const piece = run.game.tray[first!.trayIndex]!;
    expect(findPlacements(run.game.board, piece.shape)).toContainEqual([first!.row, first!.col]);

    const blocked = emptyBoard().map(() => 1);
    expect(findAdventureHelpMove({
      ...run,
      status: 'failed',
      game: {
        ...run.game,
        board: blocked,
        status: 'over',
        tray: [{ shape: SHAPES_BY_ID.get('dot')!, colorId: 1 }, null, null],
      },
    })).toBeNull();
  });
});
