import {
  ADVENTURE_GAME_CONFIG,
  createAdventureRun,
  createGame,
  emptyBoard,
  idx,
  placeAdventure,
  rescueAdventureRun,
  SHAPES_BY_ID,
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

  it('clears a failed level once, keeping score and collected jewels', () => {
    const run = createAdventureRun({
      id: 'jewel-rescue',
      seasonId: 1,
      levelIndex: 7,
      seed: 42,
      objective: { type: 'jewels', target: 2 },
      prefill: [
        { row: 1, col: 2, stoneHits: 2 },
        { row: 3, col: 4, jewel: true },
      ],
    });
    const terminal = {
      ...run,
      status: 'failed' as const,
      collectedJewels: 1,
      game: { ...run.game, score: 310, status: 'over' as const },
    };

    const recovered = rescueAdventureRun(terminal)!;
    expect(recovered.status).toBe('playing');
    expect(recovered.game.board).toEqual(emptyBoard());
    expect(recovered.game.score).toBe(310);
    expect(recovered.stonesOnBoard).toEqual({});
    expect(recovered.jewelsOnBoard).toEqual([]);
    expect(recovered.collectedJewels).toBe(1);
    expect(recovered.jewelsInTray).toHaveLength(1);
    const placed = placeAdventure(recovered, 0, 0, 0);
    expect(placed.run.status).toBe('playing');
    expect(rescueAdventureRun({
      ...recovered, status: 'failed', game: { ...recovered.game, status: 'over' },
    })).toBeNull();
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
    expect(result.event.presentationId).toBe(`${run.runId}:${run.attempt}:${result.event.score}`);
    expect(result.event.collectedJewelCells).toEqual([idx(0, 0)]);
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
      result.run.collectedJewels + result.run.jewelsOnBoard.length + result.run.jewelsInTray.length,
    ).toBeGreaterThanOrEqual(level.objective.target);
  });

  it('keeps a stone occupied after the first line hit and durably removes it on the second', () => {
    const dot = { shape: SHAPES_BY_ID.get('dot')!, colorId: 1 };
    const spec: AdventureLevelSpec = {
      id: 'stone-2',
      seasonId: 1,
      levelIndex: 3,
      seed: 12,
      objective: { type: 'jewels', target: 12 },
      prefill: Array.from({ length: 7 }, (_, col) => ({
        row: 7,
        col,
        colorId: 1,
        ...(col === 3 ? { stoneHits: 2 as const } : {}),
      })),
    };
    const initial = createAdventureRun(spec);
    initial.game.tray = [dot, dot, dot];
    const first = placeAdventure(initial, 0, 7, 7);
    expect(first.run.stonesOnBoard).toEqual({ [idx(7, 3)]: 1 });
    expect(first.run.game.board[idx(7, 3)]).toBe(1);
    expect(first.event.clearedCells).not.toContainEqual([7, 3]);
    expect(first.event.boardCleared).toBe(false);
    const restored = deserializeAdventureRun(serializeAdventureRun(first.run))!;
    expect(restored.stonesOnBoard).toEqual(first.run.stonesOnBoard);
    for (let col = 0; col < 7; col++) restored.game.board[idx(7, col)] = 1;
    restored.game.tray = [dot, dot, dot];
    const second = placeAdventure(restored, 0, 7, 7);
    expect(second.run.stonesOnBoard).toEqual({});
    expect(second.event.clearedCells).toContainEqual([7, 3]);
    expect(second.run.game.board[idx(7, 3)]).toBe(0);
    expect(second.event.boardCleared).toBe(true);
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
    const corrupt = JSON.parse(serializeAdventureRun(run));
    corrupt.game.board = [1, 2];
    expect(deserializeAdventureRun(JSON.stringify(corrupt))).toBeNull();
    const badShape = JSON.parse(serializeAdventureRun(run));
    badShape.game.tray[0].shape.id = 'removed-shape';
    expect(deserializeAdventureRun(JSON.stringify(badShape))).toBeNull();
  });

  it('migrates v2 checkpoints without inventing historical failures or help', () => {
    const run = createAdventureRun(
      {
        id: 'save-v2',
        seasonId: 1,
        levelIndex: 2,
        seed: 6,
        objective: { type: 'score', target: 180 },
      },
      3,
    );
    const legacy = JSON.parse(serializeAdventureRun(run));
    legacy.v = 2;
    delete legacy.failureCount;
    delete legacy.helpPolicy;
    delete legacy.helpUsed;

    expect(deserializeAdventureRun(JSON.stringify(legacy))).toMatchObject({
      runId: run.runId,
      attempt: 3,
      failureCount: 0,
      helpPolicy: 'none',
      helpUsed: false,
    });
  });
});
