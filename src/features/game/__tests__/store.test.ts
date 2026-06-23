import { deserialize, emptyBoard, idx, serialize, SHAPES_BY_ID } from '@/core/engine';
import { KEYS, getString, removeKey, setString } from '@/core/storage';
import { useLeaderboardStore } from '@/features/leaderboard/store';
import { useScores } from '@/features/scores';
import { useStreak } from '@/features/streak';

import { getSavedGameSummary, hasSavedGame, useGameStore } from '../store';

const dot = SHAPES_BY_ID.get('dot')!;
const sq3 = SHAPES_BY_ID.get('sq3')!;

function blockedBoard(): number[] {
  const board = emptyBoard().map(() => 1);
  for (let r = 0; r < 8; r += 1) {
    board[idx(r, r)] = 0;
    board[idx(r, (r + 1) % 8)] = 0;
  }
  return board;
}

function setNearGameOver(score: number, reviveUsed = false): void {
  useGameStore.setState({
    game: {
      board: blockedBoard(),
      tray: [{ shape: dot, colorId: 1 }, { shape: sq3, colorId: 2 }, null],
      score,
      combo: 4,
      movesSinceClear: 3,
      status: 'playing',
      reviveUsed,
      rngState: 5,
    },
    linesCleared: 4,
    finalResult: null,
    lastEvent: null,
  });
}

function setDotRun(score: number): void {
  useGameStore.setState({
    game: {
      board: emptyBoard(),
      tray: [
        { shape: dot, colorId: 1 },
        { shape: dot, colorId: 2 },
        { shape: dot, colorId: 3 },
      ],
      score,
      combo: 0,
      movesSinceClear: 0,
      status: 'playing',
      reviveUsed: false,
      rngState: 11,
    },
    linesCleared: 0,
    finalResult: null,
    lastEvent: null,
  });
}

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

describe('saved run lifecycle', () => {
  it('creates and persists a new run explicitly', () => {
    expect(hasSavedGame()).toBe(true);
    expect(useGameStore.getState().game.score).toBe(0);
  });

  it('captures the starting best for a new run and starts uncelebrated', () => {
    useScores.setState({ best: 42, gamesPlayed: 0, totalLinesCleared: 0 });

    useGameStore.getState().newGame({ seed: 7 });

    expect(useGameStore.getState().runBestAtStart).toBe(42);
    expect(useGameStore.getState().recordCelebration).toBeNull();
    expect(useGameStore.getState().recordCelebrated).toBe(false);
  });

  it('captures the first score crossing once and keeps it through later growth', () => {
    useScores.setState({ best: 0, gamesPlayed: 0, totalLinesCleared: 0 });
    useGameStore.getState().newGame({ seed: 11 });
    setDotRun(0);

    expect(useGameStore.getState().placePiece(0, 0, 0)).not.toBeNull();
    const firstCelebration = useGameStore.getState().recordCelebration;
    expect(firstCelebration).toEqual({ score: 1, previousBest: 0 });
    expect(useGameStore.getState().recordCelebrated).toBe(false);

    expect(useGameStore.getState().placePiece(1, 0, 1)).not.toBeNull();
    expect(useGameStore.getState().recordCelebration).toBe(firstCelebration);
    expect(useGameStore.getState().recordCelebrated).toBe(false);
  });

  it('loads a saved run without replaying a historical crossing', () => {
    useScores.setState({ best: 10, gamesPlayed: 0, totalLinesCleared: 0 });

    setString(
      KEYS.gameCurrent,
      serialize({
        board: emptyBoard(),
        tray: [
          { shape: dot, colorId: 1 },
          { shape: dot, colorId: 2 },
          { shape: dot, colorId: 3 },
        ],
        score: 12,
        combo: 0,
        movesSinceClear: 0,
        status: 'playing',
        reviveUsed: false,
        rngState: 9,
      }),
    );

    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(useGameStore.getState().runBestAtStart).toBe(10);
    expect(useGameStore.getState().recordCelebration).toBeNull();
    expect(useGameStore.getState().recordCelebrated).toBe(true);
  });

  it('keeps a loaded run eligible to celebrate after crossing the current best later', () => {
    useScores.setState({ best: 10, gamesPlayed: 0, totalLinesCleared: 0 });

    setString(
      KEYS.gameCurrent,
      serialize({
        board: emptyBoard(),
        tray: [
          { shape: dot, colorId: 1 },
          { shape: dot, colorId: 2 },
          { shape: dot, colorId: 3 },
        ],
        score: 9,
        combo: 0,
        movesSinceClear: 0,
        status: 'playing',
        reviveUsed: false,
        rngState: 13,
      }),
    );

    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(useGameStore.getState().recordCelebration).toBeNull();
    expect(useGameStore.getState().recordCelebrated).toBe(false);

    expect(useGameStore.getState().placePiece(0, 0, 0)).not.toBeNull();
    expect(useGameStore.getState().recordCelebration).toBeNull();
    expect(useGameStore.getState().recordCelebrated).toBe(false);

    expect(useGameStore.getState().placePiece(1, 0, 1)).not.toBeNull();
    expect(useGameStore.getState().recordCelebration).toEqual({
      score: 11,
      previousBest: 10,
    });
    expect(useGameStore.getState().recordCelebrated).toBe(false);
  });

  it('autosaves only a successful placement', () => {
    const before = getString(KEYS.gameCurrent);
    expect(useGameStore.getState().placePiece(99, 0, 0)).toBeNull();
    expect(getString(KEYS.gameCurrent)).toBe(before);

    expect(useGameStore.getState().placePiece(0, 3, 3)).not.toBeNull();
    expect(getString(KEYS.gameCurrent)).toBe(serialize(useGameStore.getState().game));
  });

  it('classifies active, terminal, final terminal, missing, and corrupt saves', () => {
    expect(getSavedGameSummary()).toEqual({ kind: 'active', score: 0, canContinue: true });

    const active = useGameStore.getState().game;
    setString(
      KEYS.gameCurrent,
      serialize({ ...active, status: 'over', score: 321, reviveUsed: false }),
    );
    expect(getSavedGameSummary()).toEqual({
      kind: 'terminal',
      score: 321,
      canContinue: true,
    });

    setString(
      KEYS.gameCurrent,
      serialize({ ...active, status: 'over', score: 654, reviveUsed: true }),
    );
    expect(getSavedGameSummary()).toEqual({
      kind: 'terminal',
      score: 654,
      canContinue: false,
    });

    removeKey(KEYS.gameCurrent);
    expect(getSavedGameSummary()).toEqual({ kind: 'none', score: null, canContinue: false });

    setString(KEYS.gameCurrent, '{broken');
    expect(getSavedGameSummary()).toEqual({ kind: 'none', score: null, canContinue: false });
    expect(getString(KEYS.gameCurrent)).toBeNull();
  });

  it('loads active and terminal saves without creating a new run', () => {
    useGameStore.getState().placePiece(0, 3, 3);
    const active = serialize(useGameStore.getState().game);
    useGameStore.getState().newGame();
    setString(KEYS.gameCurrent, active);
    const proofBeforeActiveLoad = useLeaderboardStore.getState().activeProof;
    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(serialize(useGameStore.getState().game)).toBe(active);
    expect(useLeaderboardStore.getState().activeProof).toEqual(proofBeforeActiveLoad);

    const terminal = {
      ...useGameStore.getState().game,
      score: 900,
      status: 'over' as const,
      reviveUsed: false,
    };
    setString(KEYS.gameCurrent, serialize(terminal));
    const proofBeforeTerminalLoad = useLeaderboardStore.getState().activeProof;
    expect(useGameStore.getState().loadSaved()).toBe('terminal');
    expect(useGameStore.getState().game).toEqual(terminal);
    expect(useGameStore.getState().lastEvent).toBeNull();
    expect(useGameStore.getState().finalResult).toBeNull();
    expect(useLeaderboardStore.getState().activeProof).toEqual(proofBeforeTerminalLoad);
  });

  it('removes a corrupt save without replacing the live run', () => {
    const gameBefore = serialize(useGameStore.getState().game);
    const proofBefore = useLeaderboardStore.getState().activeProof;
    setString(KEYS.gameCurrent, '{broken');

    expect(useGameStore.getState().loadSaved()).toBeNull();
    expect(serialize(useGameStore.getState().game)).toBe(gameBefore);
    expect(useLeaderboardStore.getState().activeProof).toEqual(proofBefore);
    expect(getString(KEYS.gameCurrent)).toBeNull();
  });
});

describe('Game Over and Continue accounting', () => {
  it('persists the first terminal result and accounts for it once', () => {
    setNearGameOver(777);

    const event = useGameStore.getState().placePiece(0, 0, 0)!;

    expect(event.gameOver).toBe(true);
    expect(useGameStore.getState().finalResult).toEqual({ newRecord: true, delta: 778 });
    expect(useScores.getState().gamesPlayed).toBe(1);
    expect(useScores.getState().best).toBe(778);
    expect(useStreak.getState().count).toBe(1);
    expect(deserialize(getString(KEYS.gameCurrent)!)).toEqual(useGameStore.getState().game);
    expect(getSavedGameSummary()).toEqual({
      kind: 'terminal',
      score: 778,
      canContinue: true,
    });
  });

  it('continues once, preserving score and tray while clearing the board', () => {
    setNearGameOver(100);
    useGameStore.getState().placePiece(0, 0, 0);
    const terminal = useGameStore.getState().game;
    useGameStore.setState({ recordCelebration: { score: 101, previousBest: 100 }, recordCelebrated: true });

    expect(useGameStore.getState().continueGame()).toBe(true);
    const continued = useGameStore.getState().game;
    expect(continued.status).toBe('playing');
    expect(continued.reviveUsed).toBe(true);
    expect(continued.score).toBe(terminal.score);
    expect(continued.tray).toEqual(terminal.tray);
    expect(continued.rngState).toBe(terminal.rngState);
    expect(continued.board.every((cell) => cell === 0)).toBe(true);
    expect(continued.combo).toBe(0);
    expect(continued.movesSinceClear).toBe(0);
    expect(useGameStore.getState().lastEvent).toBeNull();
    expect(useGameStore.getState().finalResult).toBeNull();
    expect(useGameStore.getState().recordCelebration).toEqual({
      score: 101,
      previousBest: 100,
    });
    expect(useGameStore.getState().recordCelebrated).toBe(true);
    expect(getString(KEYS.gameCurrent)).toBe(serialize(continued));

    useGameStore.setState({ game: { ...continued, status: 'over' } });
    expect(useGameStore.getState().continueGame()).toBe(false);
    expect(useGameStore.getState().game.status).toBe('over');
  });

  it('freezes ranked and game-count accounting at first Game Over', () => {
    useLeaderboardStore.setState({
      tickets: [{ ticketId: 'ticket-1', seed: 5, expiresAt: '2099-06-20T00:00:00.000Z' }],
    });
    useGameStore.getState().newGame({ mode: 'weekly' });
    setNearGameOver(777);

    useGameStore.getState().placePiece(0, 0, 0);
    expect(useLeaderboardStore.getState().latestImpact?.score).toBe(778);
    expect(useGameStore.getState().continueGame()).toBe(true);

    setNearGameOver(1500, true);
    useGameStore.getState().placePiece(0, 0, 0);

    // Record-only: счёт после ревайва ТОЖЕ уходит на сервер (второй сабмит без
    // тикета) — поэтому impact и очередь отражают ревайв-рекорд 1501.
    expect(useLeaderboardStore.getState().latestImpact?.score).toBe(1501);
    expect(useLeaderboardStore.getState().pendingSubmissions).toHaveLength(2);
    // Но игровой счётчик партий заморожен на первом Game Over: ревайв — та же партия.
    expect(useScores.getState().gamesPlayed).toBe(1);
    expect(useScores.getState().best).toBe(1501);
    expect(useStreak.getState().count).toBe(1);
    // Локальный недельный best поднят, без второй ПАРТИИ (runsCount не растёт).
    expect(useLeaderboardStore.getState().localWeeklyResult).toMatchObject({
      bestScore: 1501,
      runsCount: 1,
    });
    expect(getSavedGameSummary()).toEqual({
      kind: 'terminal',
      score: 1501,
      canContinue: false,
    });
  });

  it('cold-loading a terminal save does not repeat accounting', () => {
    setNearGameOver(500);
    useGameStore.getState().placePiece(0, 0, 0);
    const terminalSave = getString(KEYS.gameCurrent)!;
    const stats = useScores.getState();
    const streak = useStreak.getState();
    const pending = useLeaderboardStore.getState().pendingSubmissions;

    useGameStore.getState().newGame();
    setString(KEYS.gameCurrent, terminalSave);
    expect(useGameStore.getState().loadSaved()).toBe('terminal');

    expect(useScores.getState().gamesPlayed).toBe(stats.gamesPlayed);
    expect(useScores.getState().best).toBe(stats.best);
    expect(useStreak.getState().count).toBe(streak.count);
    expect(useLeaderboardStore.getState().pendingSubmissions).toEqual(pending);
    expect(useGameStore.getState().lastEvent).toBeNull();
    expect(useGameStore.getState().finalResult).toBeNull();
  });

  // --- Маскот «Капи»: epoch-сигнал и помощник «свап» (спека 09) ---

  it('epoch grows on newGame and loadSaved, but not on continueGame', () => {
    const start = useGameStore.getState().epoch;

    useGameStore.getState().newGame();
    expect(useGameStore.getState().epoch).toBe(start + 1);

    const beforeLoad = useGameStore.getState().epoch;
    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(useGameStore.getState().epoch).toBe(beforeLoad + 1);

    // continueGame (revive) НЕ меняет epoch — маскот не «возвращается» при оживлении.
    setNearGameOver(50);
    useGameStore.getState().placePiece(0, 0, 0); // game over
    const beforeContinue = useGameStore.getState().epoch;
    expect(useGameStore.getState().continueGame()).toBe(true);
    expect(useGameStore.getState().epoch).toBe(beforeContinue);
  });

  it('replaceTrayPiece swaps the slot piece, autosaves, leaves board/score', () => {
    const before = useGameStore.getState().game;
    const otherA = before.tray[1];
    const otherB = before.tray[2];

    useGameStore.getState().replaceTrayPiece(0);
    const after = useGameStore.getState().game;

    expect(after.tray[0]).not.toBeNull();
    expect(after.tray[1]).toEqual(otherA);
    expect(after.tray[2]).toEqual(otherB);
    expect(after.board).toEqual(before.board);
    expect(after.score).toBe(before.score);
    expect(getString(KEYS.gameCurrent)).toBe(serialize(after));
  });

  it('replaceTrayPiece is a safe no-op for an empty slot', () => {
    const g = useGameStore.getState().game;
    useGameStore.setState({ game: { ...g, tray: [g.tray[0], null, g.tray[2]] } });
    const before = serialize(useGameStore.getState().game);
    expect(() => useGameStore.getState().replaceTrayPiece(1)).not.toThrow();
    expect(serialize(useGameStore.getState().game)).toBe(before);
  });

  it('restoreGame restores a snapshot and autosaves (swap undo)', () => {
    const snapshot = useGameStore.getState().game;
    const snapStr = serialize(snapshot);

    useGameStore.getState().replaceTrayPiece(0);
    expect(serialize(useGameStore.getState().game)).not.toBe(snapStr);

    useGameStore.getState().restoreGame(snapshot);
    expect(serialize(useGameStore.getState().game)).toBe(snapStr);
    expect(getString(KEYS.gameCurrent)).toBe(snapStr);
  });
});
