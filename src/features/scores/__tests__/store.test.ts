import { KEYS, getJSON } from '@/core/storage';

import { useScores } from '../store';

beforeEach(() => {
  useScores.setState({ best: 0, gamesPlayed: 0, totalLinesCleared: 0 });
});

describe('useScores.submitGame', () => {
  it('новый рекорд с дельтой', () => {
    useScores.setState({ best: 100 });
    const r = useScores.getState().submitGame(250, 7);
    expect(r).toEqual({ newRecord: true, delta: 150 });
    expect(useScores.getState().best).toBe(250);
  });

  it('не рекорд — best не меняется, delta 0', () => {
    useScores.setState({ best: 500 });
    const r = useScores.getState().submitGame(300, 4);
    expect(r).toEqual({ newRecord: false, delta: 0 });
    expect(useScores.getState().best).toBe(500);
  });

  it('копит статистику и персистит', () => {
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

  it('resetBest обнуляет только рекорд', () => {
    useScores.getState().submitGame(100, 3);
    useScores.getState().resetBest();
    expect(useScores.getState().best).toBe(0);
    expect(useScores.getState().gamesPlayed).toBe(1);
  });
});
