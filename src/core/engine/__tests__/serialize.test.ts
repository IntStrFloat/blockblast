import { findPlacements } from '../board';
import { createGame, place } from '../game';
import { deserialize, serialize } from '../serialize';
import type { GameState } from '../types';

/** Детерминированно играет N валидных ходов */
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

describe('serialize / deserialize', () => {
  it('roundtrip сохраняет партию полностью', () => {
    const g = playMoves(createGame(7), 4);
    const restored = deserialize(serialize(g));
    expect(restored).not.toBeNull();
    expect(restored!.board).toEqual(g.board);
    expect(restored!.score).toBe(g.score);
    expect(restored!.combo).toBe(g.combo);
    expect(restored!.rngState).toBe(g.rngState);
    expect(restored!.status).toBe(g.status);
    expect(restored!.reviveUsed).toBe(g.reviveUsed);
    expect(restored!.tray.map((p) => (p ? `${p.shape.id}:${p.colorId}` : '-'))).toEqual(
      g.tray.map((p) => (p ? `${p.shape.id}:${p.colorId}` : '-')),
    );
  });

  it('мусор и чужие версии отбрасываются', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{}')).toBeNull();
    expect(deserialize(JSON.stringify({ v: 99 }))).toBeNull();
  });

  it('неизвестный id фигуры — отбрасывается', () => {
    const g = createGame(7);
    const raw = JSON.parse(serialize(g));
    raw.tray[0].id = 'no-such-shape';
    expect(deserialize(JSON.stringify(raw))).toBeNull();
  });

  it('битая доска — отбрасывается', () => {
    const g = createGame(7);
    const raw = JSON.parse(serialize(g));
    raw.board = [1, 2, 3];
    expect(deserialize(JSON.stringify(raw))).toBeNull();
  });
});

describe('детерминизм партии', () => {
  it('одинаковый seed + одинаковые ходы → одинаковое состояние', () => {
    const a = playMoves(createGame(99), 10);
    const b = playMoves(createGame(99), 10);
    expect(serialize(a)).toBe(serialize(b));
    expect(a.score).toBeGreaterThan(0);
  });
});
