import { emptyBoard, findPlacements } from '../board';
import { DEFAULT_CONFIG } from '../config';
import { createGame, place, revive } from '../game';
import { SHAPES_BY_ID } from '../shapes';
import {
  CLASSIC_CHECKPOINT_VERSION,
  deserialize,
  deserializeClassicCheckpoint,
  serialize,
  serializeClassicCheckpoint,
} from '../serialize';
import type { GameState } from '../types';

const dot = SHAPES_BY_ID.get('dot')!;
const h3 = SHAPES_BY_ID.get('h3')!;

function playMoves(g: GameState, moves: number): GameState {
  for (let step = 0; step < moves; step++) {
    const i = g.tray.findIndex((p) => p !== null);
    if (i < 0) break;
    const spots = findPlacements(g.board, g.tray[i]!.shape);
    if (spots.length === 0) break;
    const [r, c] = spots[0];
    g = place(g, i, r, c).state;
    if (g.status === 'over') break;
  }
  return g;
}

function expectRoundTrip(state: GameState): void {
  const restored = deserialize(serialize(state));
  expect(restored).not.toBeNull();
  expect(restored).toEqual(state);
}

describe('serialize / deserialize', () => {
  it('round-trips a versioned checkpoint with run rules and cumulative counters', () => {
    const game = playMoves(createGame(7, DEFAULT_CONFIG), 2);
    const raw = serializeClassicCheckpoint(game, {
      checkpointVersion: CLASSIC_CHECKPOINT_VERSION,
      runId: 'run-7',
      runKind: 'classic',
      lifecycle: 'active',
      configId: 'classic-experience-0',
      activeConfig: DEFAULT_CONFIG,
      linesCleared: 7,
      placements: 2,
      activeDurationMs: 1_234,
      activeSinceAt: 5_000,
      bestAtStart: 99,
      settlement: null,
    });

    expect(deserializeClassicCheckpoint(raw)).toEqual({
      game,
      meta: expect.objectContaining({
        checkpointVersion: CLASSIC_CHECKPOINT_VERSION,
        runId: 'run-7',
        configId: 'classic-experience-0',
        activeConfig: DEFAULT_CONFIG,
        linesCleared: 7,
        placements: 2,
        activeDurationMs: 1_234,
      }),
    });
  });

  it('rejects incomplete generator rules and inconsistent completed settlements', () => {
    const game = createGame(7, DEFAULT_CONFIG);
    const base = JSON.parse(serializeClassicCheckpoint(game, {
      checkpointVersion: CLASSIC_CHECKPOINT_VERSION,
      runId: 'run-7',
      runKind: 'classic',
      lifecycle: 'active',
      configId: 'classic-experience-0',
      activeConfig: DEFAULT_CONFIG,
      linesCleared: 0,
      placements: 0,
      activeDurationMs: 0,
      activeSinceAt: 1,
      bestAtStart: 0,
      settlement: null,
    }));
    delete base.meta.activeConfig.spawn.candidates;
    expect(deserializeClassicCheckpoint(JSON.stringify(base))).toBeNull();

    base.meta.activeConfig = DEFAULT_CONFIG;
    base.game.status = 'over';
    base.meta.lifecycle = 'terminal_final';
    base.meta.settlement = {
      revision: 1,
      previousTargetScore: 0,
      targetScore: 10,
      reason: 'game_over',
      result: null,
      phase: 'complete',
      committedAt: 1,
      completedAt: 2,
    };
    expect(deserializeClassicCheckpoint(JSON.stringify(base))).toBeNull();
  });

  it('round-trips an active game in v1 format', () => {
    expectRoundTrip(playMoves(createGame(7), 4));
  });

  it('round-trips a terminal game in v1 format', () => {
    const over: GameState = {
      board: emptyBoard(),
      tray: [null, { shape: dot, colorId: 4 }, { shape: h3, colorId: 2 }],
      score: 321,
      combo: 2,
      movesSinceClear: 1,
      waveNumber: 3,
      status: 'over',
      reviveUsed: false,
      rngState: 77,
    };

    expectRoundTrip(over);
  });

  it('round-trips a continued game with reviveUsed=true and preserved tray holes', () => {
    const revived = revive({
      board: emptyBoard().map((_, index) => (index === 0 ? 5 : 0)),
      tray: [null, { shape: dot, colorId: 6 }, { shape: h3, colorId: 2 }],
      score: 654,
      combo: 4,
      movesSinceClear: 3,
      waveNumber: 3,
      status: 'over',
      reviveUsed: false,
      rngState: 123,
    });

    expect(revived).not.toBeNull();
    expectRoundTrip(revived!);
  });

  it('reads an existing v1 payload as a post-opening game', () => {
    const payload = JSON.stringify({
      v: 1,
      board: emptyBoard(),
      tray: [null, { id: 'dot', colorId: 6 }, { id: 'h3', colorId: 2 }],
      score: 999,
      combo: 0,
      movesSinceClear: 0,
      status: 'playing',
      reviveUsed: true,
      rngState: 42,
    });

    expect(deserialize(payload)).toEqual({
      board: emptyBoard(),
      tray: [null, { shape: dot, colorId: 6 }, { shape: h3, colorId: 2 }],
      score: 999,
      combo: 0,
      movesSinceClear: 0,
      waveNumber: 3,
      status: 'playing',
      reviveUsed: true,
      rngState: 42,
    });
  });

  it('rejects corrupt payloads', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{}')).toBeNull();
    expect(deserialize(JSON.stringify({ v: 99 }))).toBeNull();

    const g = createGame(7);
    const unknownShape = JSON.parse(serialize(g));
    unknownShape.tray[0].id = 'no-such-shape';
    expect(deserialize(JSON.stringify(unknownShape))).toBeNull();

    const badBoard = JSON.parse(serialize(g));
    badBoard.board = [1, 2, 3];
    expect(deserialize(JSON.stringify(badBoard))).toBeNull();

    const badStatus = JSON.parse(serialize(g));
    badStatus.status = 'paused';
    expect(deserialize(JSON.stringify(badStatus))).toBeNull();
  });
});

describe('game determinism', () => {
  it('same seed plus same moves yields the same state', () => {
    const a = playMoves(createGame(99), 10);
    const b = playMoves(createGame(99), 10);
    expect(serialize(a)).toBe(serialize(b));
    expect(a.score).toBeGreaterThan(0);
  });
});
