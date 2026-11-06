import { createAdventureRun, findPlacements, placeAdventure } from '@/core/engine';
import type { AdventureRun } from '@/core/engine';

import { findAdventureHelpMove } from '../logic/failure';
import { levelFor } from '../logic/levels';

type Strategy = 'first_legal' | 'safe_hint';

interface SimulationResult {
  strategy: Strategy;
  level: number;
  attempt: number;
  status: AdventureRun['status'];
  moves: number;
  score: number;
}

function moveFor(run: AdventureRun, strategy: Strategy) {
  if (strategy === 'safe_hint') {
    const hint = findAdventureHelpMove(run);
    if (hint) return hint;
  }
  for (const [trayIndex, piece] of run.game.tray.entries()) {
    if (!piece) continue;
    const position = findPlacements(run.game.board, piece.shape)[0];
    if (position) return { trayIndex, row: position[0], col: position[1] };
  }
  return null;
}

function simulate(strategy: Strategy, levelIndex: number, attempt: number): SimulationResult {
  let run = createAdventureRun(levelFor(1, levelIndex), attempt);
  let moves = 0;
  while (run.status === 'playing' && moves < 500) {
    const move = moveFor(run, strategy);
    if (!move) break;
    run = placeAdventure(run, move.trayIndex, move.row, move.col).run;
    moves += 1;
  }
  return {
    strategy,
    level: levelIndex + 1,
    attempt,
    status: run.status,
    moves,
    score: run.game.score,
  };
}

describe('G16 fixed-seed scenario runs', () => {
  const matrix = (['first_legal', 'safe_hint'] as const).flatMap((strategy) =>
    Array.from({ length: 5 }, (_, levelIndex) =>
      Array.from({ length: 3 }, (_, attempt) => simulate(strategy, levelIndex, attempt)),
    ).flat(),
  );

  it('is deterministic and every simple-strategy run reaches a real terminal outcome', () => {
    expect(matrix.every((result) => result.status !== 'playing' && result.moves < 500)).toBe(true);
    expect(
      matrix.map(({ strategy, level, attempt }) => simulate(strategy, level - 1, attempt)),
    ).toEqual(matrix);
    if (process.env.G16_SIM_REPORT === '1') {
      console.log('G16_SIM_RESULTS=' + JSON.stringify(matrix));
    }
  });

  it('the free highlight changes presentation metadata, not the board, tray, objective or seed', () => {
    const level = levelFor(1, 0);
    const normal = createAdventureRun(level, 2, undefined, 'normal', {
      failureCount: 2,
      helpPolicy: 'none',
    });
    const assisted = createAdventureRun(level, 2, undefined, 'assisted', {
      failureCount: 2,
      helpPolicy: 'highlight',
    });
    expect(assisted.game).toEqual(normal.game);
    expect(assisted.level).toEqual(normal.level);

    const move = findAdventureHelpMove(assisted)!;
    const piece = assisted.game.tray[move.trayIndex]!;
    expect(findPlacements(assisted.game.board, piece.shape)).toContainEqual([move.row, move.col]);
    expect(placeAdventure(assisted, move.trayIndex, move.row, move.col).run.status).toBe('playing');
  });
});
