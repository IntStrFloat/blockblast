import {
  ADVENTURE_GAME_CONFIG,
  createAdventureRun,
  createGame,
  emptyBoard,
  idx,
  placeAdventure,
  serializeAdventureRun,
  deserializeAdventureRun,
} from '../index';
import type { AdventureLevelSpec, Board } from '../index';

describe('createGame initial board', () => {
  it('keeps prefilled cells and deals a playable tray', () => {
    const board: Board = emptyBoard();
    board[idx(7, 0)] = 1;
    board[idx(7, 1)] = 1;

    const game = createGame(42, undefined, board);

    expect(game.board[idx(7, 0)]).toBe(1);
    expect(game.board[idx(7, 1)]).toBe(1);
    expect(game.tray.every((p) => p !== null)).toBe(true);
  });

  it('defaults to an empty board when omitted', () => {
    const game = createGame(42);
    expect(game.board.every((c) => c === 0)).toBe(true);
  });
});

describe('adventure run', () => {
  it('wins score objective without changing base game status', () => {
    const level: AdventureLevelSpec = {
      id: 'score-1',
      seasonId: 1,
      levelIndex: 0,
      seed: 12,
      objective: { type: 'score', target: 1 },
    };
    const run = createAdventureRun(level);
    const slot = run.game.tray.findIndex((p) => p !== null);
    const result = placeAdventure(run, slot, 0, 0);

    expect(result.run.status).toBe('won');
    expect(result.run.game.status).toBe('playing');
    expect(result.event.adventureStatus).toBe('won');
  });

  it('collects board jewels only when their line clears', () => {
    const level: AdventureLevelSpec = {
      id: 'jewel-1',
      seasonId: 1,
      levelIndex: 7,
      seed: 1,
      objective: { type: 'jewels', target: 1 },
      prefill: Array.from({ length: 7 }, (_, col) => ({
        row: 0,
        col,
        colorId: 1,
        jewel: col === 0,
      })),
    };
    const run = createAdventureRun(level);
    run.game.tray = [
      { shape: { id: 'dot', w: 1, h: 1, weight: 1, cells: [[0, 0]] }, colorId: 1 },
      null,
      null,
    ];

    const result = placeAdventure(run, 0, 0, 7, ADVENTURE_GAME_CONFIG);

    expect(result.event.jewelsCollectedThisMove).toBe(1);
    expect(result.run.collectedJewels).toBe(1);
    expect(result.run.status).toBe('won');
  });

  it('seeds new tray jewels after a refill until the jewel target remains reachable', () => {
    const level: AdventureLevelSpec = {
      id: 'jewel-refill',
      seasonId: 1,
      levelIndex: 7,
      seed: 9,
      objective: { type: 'jewels', target: 3 },
      jewelTrayCells: [{ slot: 0, cell: 0 }],
    };
    const dot = { id: 'dot', w: 1, h: 1, weight: 1, cells: [[0, 0]] as const };
    let run = createAdventureRun(level);
    run = {
      ...run,
      game: {
        ...run.game,
        tray: [
          { shape: dot, colorId: 1 },
          { shape: dot, colorId: 1 },
          { shape: dot, colorId: 1 },
        ],
      },
    };

    run = placeAdventure(run, 0, 0, 0).run;
    run = placeAdventure(run, 1, 0, 1).run;
    const result = placeAdventure(run, 2, 0, 2);

    expect(result.event.newTray).toBe(true);
    expect(result.run.jewelsInTray.length).toBeGreaterThan(0);
    expect(
      result.run.collectedJewels +
        result.run.jewelsOnBoard.length +
        result.run.jewelsInTray.length,
    ).toBeGreaterThanOrEqual(level.objective.target);
  });

  it('round-trips serialized run state', () => {
    const run = createAdventureRun({
      id: 'save-1',
      seasonId: 1,
      levelIndex: 0,
      seed: 5,
      objective: { type: 'score', target: 100 },
    });

    expect(deserializeAdventureRun(serializeAdventureRun(run))).toEqual(run);
    expect(deserializeAdventureRun('{')).toBeNull();
  });
});
