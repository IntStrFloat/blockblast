import { appendRunMove, beginRunProof, finalizeRunProof } from '../runProof';

describe('leaderboard run proof', () => {
  it('records successful moves in order', () => {
    const proof = beginRunProof({
      seed: 1234,
      startedAt: '2026-06-13T10:00:00.000Z',
      mode: 'weekly',
    });

    const next = appendRunMove(proof, { trayIndex: 2, row: 4, col: 1 });

    expect(next.moves).toEqual([{ trayIndex: 2, row: 4, col: 1 }]);
  });

  it('freezes the first game-over score and stays idempotent afterwards', () => {
    const started = beginRunProof({
      seed: 1234,
      startedAt: '2026-06-13T10:00:00.000Z',
      mode: 'weekly',
    });
    const finished = finalizeRunProof(started, {
      score: 1280,
      finishedAt: '2026-06-13T10:05:00.000Z',
    });
    const finalizedAgain = finalizeRunProof(finished, {
      score: 2200,
      finishedAt: '2026-06-13T10:06:00.000Z',
    });

    expect(finished.frozenScore).toBe(1280);
    expect(finalizedAgain.frozenScore).toBe(1280);
    expect(finalizedAgain.finishedAt).toBe('2026-06-13T10:05:00.000Z');
  });

  it('ignores move appends after the proof is frozen', () => {
    const started = beginRunProof({
      seed: 1234,
      startedAt: '2026-06-13T10:00:00.000Z',
      mode: 'weekly',
    });
    const finished = finalizeRunProof(started, {
      score: 1280,
      finishedAt: '2026-06-13T10:05:00.000Z',
    });

    const next = appendRunMove(finished, { trayIndex: 0, row: 0, col: 0 });

    expect(next.moves).toEqual([]);
  });
});
