const assert = require('node:assert/strict');
const test = require('node:test');

const { verifyRun } = require('../verify-run.cjs');

test('server replay rejects an impossible move', () => {
  const result = verifyRun({
    seed: 123,
    score: 100,
    moves: [{ trayIndex: 99, row: 0, col: 0 }],
  });
  assert.deepEqual(result, { ok: false, reason: 'invalid_move' });
});

test('server replay rejects a score that does not match replayed state', () => {
  const result = verifyRun({
    seed: 123,
    score: 100,
    moves: [{ trayIndex: 0, row: 0, col: 0 }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_game_over');
});
