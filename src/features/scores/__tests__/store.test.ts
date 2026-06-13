import { KEYS, getJSON } from '@/core/storage';

import { useScores } from '../store';

beforeEach(() => {
  useScores.setState({ best: 0, gamesPlayed: 0, totalLinesCleared: 0 });
});

describe('useScores.submitGame', () => {
  it('returns a new-record delta when score beats best', () => {
    useScores.setState({ best: 100 });
    const r = useScores.getState().submitGame(250, 7);
    expect(r).toEqual({ newRecord: true, delta: 150 });
    expect(useScores.getState().best).toBe(250);
  });

  it('keeps best unchanged when score does not beat it', () => {
    useScores.setState({ best: 500 });
    const r = useScores.getState().submitGame(300, 4);
    expect(r).toEqual({ newRecord: false, delta: 0 });
    expect(useScores.getState().best).toBe(500);
  });

  it('accumulates stats and persists them', () => {
    useScores.getState().submitGame(100, 3);
    useScores.getState().submitGame(50, 2);
    const s = useScores.getState();
    expect(s.gamesPlayed).toBe(2);
    expect(s.totalLinesCleared).toBe(5);
    expect(getJSON(KEYS.scoresStats)).toEqual({
      best: 100,
      gamesPlayed: 2,
      totalLinesCleared: 5,
    });
  });

  it('resetBest clears only the best score', () => {
    useScores.getState().submitGame(100, 3);
    useScores.getState().resetBest();
    expect(useScores.getState().best).toBe(0);
    expect(useScores.getState().gamesPlayed).toBe(1);
  });
});

describe('useScores.improveBest', () => {
  it('updates and persists best without changing aggregate counters', () => {
    useScores.setState({ best: 100, gamesPlayed: 4, totalLinesCleared: 25 });
    const result = useScores.getState().improveBest(160);

    expect(result).toEqual({ newRecord: true, delta: 60 });
    expect(useScores.getState()).toMatchObject({
      best: 160,
      gamesPlayed: 4,
      totalLinesCleared: 25,
    });
    expect(getJSON(KEYS.scoresStats)).toEqual({
      best: 160,
      gamesPlayed: 4,
      totalLinesCleared: 25,
    });
  });

  it('rejects non-improving scores without mutating counters', () => {
    useScores.setState({ best: 200, gamesPlayed: 3, totalLinesCleared: 12 });
    const result = useScores.getState().improveBest(150);

    expect(result).toEqual({ newRecord: false, delta: 0 });
    expect(useScores.getState()).toMatchObject({
      best: 200,
      gamesPlayed: 3,
      totalLinesCleared: 12,
    });
  });
});
