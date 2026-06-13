import { emptyBoard, idx, serialize, SHAPES_BY_ID } from '@/core/engine';
import { KEYS, getString, removeKey, setString } from '@/core/storage';
import { useLeaderboardStore } from '@/features/leaderboard/store';
import { useScores } from '@/features/scores';
import { useStreak } from '@/features/streak';

import { hasSavedGame, useGameStore } from '../store';

const dot = SHAPES_BY_ID.get('dot')!;
const sq3 = SHAPES_BY_ID.get('sq3')!;

beforeEach(() => {
  removeKey(KEYS.gameCurrent);
  removeKey(KEYS.leaderboardActiveProof);
  removeKey(KEYS.leaderboardRuns);
  removeKey(KEYS.leaderboardSnapshot);
  removeKey(KEYS.leaderboardDaily);
  removeKey(KEYS.leaderboardPending);
  removeKey(KEYS.leaderboardTickets);
  useScores.setState({ best: 0, gamesPlayed: 0, totalLinesCleared: 0 });
  useStreak.setState({ lastDay: null, count: 0 });
  useLeaderboardStore.getState().resetForTests({
    nickname: 'LimeComet',
    normalizedNickname: 'limecomet',
    tag: '00H',
    seed: 7,
  });
  useGameStore.getState().newGame();
});

describe('useGameStore', () => {
  it('newGame создаёт партию и пишет сейв', () => {
    expect(hasSavedGame()).toBe(true);
    expect(useGameStore.getState().game.score).toBe(0);
  });

  it('placePiece обновляет состояние и автосейвит', () => {
    const ev = useGameStore.getState().placePiece(0, 3, 3);
    expect(ev).not.toBeNull();
    const saved = getString(KEYS.gameCurrent)!;
    expect(saved).toBe(serialize(useGameStore.getState().game));
  });

  it('невалидный дроп -> null, состояние не меняется', () => {
    const before = serialize(useGameStore.getState().game);
    const ev = useGameStore.getState().placePiece(0, 7, 7);
    if (ev === null) {
      expect(serialize(useGameStore.getState().game)).toBe(before);
    }
    const bad = useGameStore.getState().placePiece(99, 0, 0);
    expect(bad).toBeNull();
  });

  it('loadSaved восстанавливает партию', () => {
    useGameStore.getState().placePiece(0, 3, 3);
    const expected = serialize(useGameStore.getState().game);
    useGameStore.getState().newGame();
    setString(KEYS.gameCurrent, expected);
    const ok = useGameStore.getState().loadSaved();
    expect(ok).toBe(true);
    expect(serialize(useGameStore.getState().game)).toBe(expected);
  });

  it('game over: фиксирует рекорд, стрик, чистит сейв', () => {
    const board = emptyBoard().map(() => 1);
    for (let r = 0; r < 8; r += 1) {
      board[idx(r, r)] = 0;
      board[idx(r, (r + 1) % 8)] = 0;
    }
    useGameStore.setState({
      game: {
        board,
        tray: [{ shape: dot, colorId: 1 }, { shape: sq3, colorId: 2 }, null],
        score: 777,
        combo: 0,
        movesSinceClear: 0,
        status: 'playing',
        reviveUsed: false,
        rngState: 5,
      },
      linesCleared: 4,
      finalResult: null,
    });
    const ev = useGameStore.getState().placePiece(0, 0, 0)!;
    expect(ev.gameOver).toBe(true);
    expect(useGameStore.getState().finalResult).toEqual({ newRecord: true, delta: 778 });
    expect(useScores.getState().gamesPlayed).toBe(1);
    expect(useScores.getState().best).toBe(778);
    expect(useStreak.getState().count).toBe(1);
    expect(hasSavedGame()).toBe(false);
  });

  it('revive возвращает в игру и восстанавливает сейв', () => {
    const board = emptyBoard().map(() => 1);
    for (let r = 0; r < 8; r += 1) {
      board[idx(r, r)] = 0;
      board[idx(r, (r + 1) % 8)] = 0;
    }
    useGameStore.setState({
      game: {
        board,
        tray: [{ shape: dot, colorId: 1 }, { shape: sq3, colorId: 2 }, null],
        score: 100,
        combo: 0,
        movesSinceClear: 0,
        status: 'playing',
        reviveUsed: false,
        rngState: 5,
      },
    });
    useGameStore.getState().placePiece(0, 0, 0);
    useGameStore.getState().reviveGame();
    const g = useGameStore.getState().game;
    expect(g.status).toBe('playing');
    expect(g.reviveUsed).toBe(true);
    expect(g.score).toBe(101);
    expect(useGameStore.getState().finalResult).toBeNull();
    expect(hasSavedGame()).toBe(true);
    useGameStore.setState({ game: { ...g, status: 'over' } });
    useGameStore.getState().reviveGame();
    expect(useGameStore.getState().game.status).toBe('over');
  });

  it('freezes ranked score on first game over and revive does not mutate it', () => {
    useLeaderboardStore.setState({
      tickets: [{ ticketId: 'ticket-1', seed: 5, expiresAt: '2026-06-20T00:00:00.000Z' }],
    });
    useGameStore.getState().newGame({ mode: 'weekly' });
    const board = emptyBoard().map(() => 1);
    for (let r = 0; r < 8; r += 1) {
      board[idx(r, r)] = 0;
      board[idx(r, (r + 1) % 8)] = 0;
    }
    useGameStore.setState({
      game: {
        board,
        tray: [{ shape: dot, colorId: 1 }, { shape: sq3, colorId: 2 }, null],
        score: 777,
        combo: 0,
        movesSinceClear: 0,
        status: 'playing',
        reviveUsed: false,
        rngState: 5,
      },
      linesCleared: 4,
      finalResult: null,
    });

    useGameStore.getState().placePiece(0, 0, 0);
    const frozen = useLeaderboardStore.getState().latestImpact;
    expect(frozen?.score).toBe(778);
    expect(frozen?.queued).toBe(true);

    useGameStore.getState().reviveGame();
    useGameStore.setState({
      game: {
        ...useGameStore.getState().game,
        board,
        tray: [{ shape: dot, colorId: 1 }, { shape: sq3, colorId: 2 }, null],
        score: 1500,
        status: 'playing',
      },
      linesCleared: 4,
    });
    useGameStore.getState().placePiece(0, 0, 0);

    expect(useLeaderboardStore.getState().latestImpact?.score).toBe(778);
    expect(useLeaderboardStore.getState().pendingSubmissions).toHaveLength(1);
  });
});
