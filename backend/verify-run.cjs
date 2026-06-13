function verifyRun(input) {
  const { createGame, place } = require('./runtime/game.js');
  let state = createGame(input.seed);

  for (const move of input.moves) {
    try {
      const result = place(state, move.trayIndex, move.row, move.col);
      state = result.state;
    } catch {
      return { ok: false, reason: 'invalid_move' };
    }
    if (state.status === 'over') break;
  }

  if (state.status !== 'over') return { ok: false, reason: 'not_game_over' };
  if (state.score !== input.score) return { ok: false, reason: 'score_mismatch' };
  return { ok: true, score: state.score };
}

module.exports = { verifyRun };
