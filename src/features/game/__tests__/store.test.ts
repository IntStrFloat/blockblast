import {
  deserialize,
  deserializeAdventureRun,
  emptyBoard,
  idx,
  serialize,
  serializeAdventureRun,
  SHAPES_BY_ID,
} from '@/core/engine';
import { KEYS, getJSON, getString, removeKey, setJSON, setString } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';
import { adventureCompletionIdentity } from '@/features/adventure/logic/xp';
import { levelFor } from '@/features/adventure/logic/levels';
import { seasonLength } from '@/features/adventure/logic/seasons';
import { useAdventure } from '@/features/adventure/store';
import { useLeaderboardStore } from '@/features/leaderboard/store';
import {
  createTutorialGame,
  FTUE_METRIC_VERSION,
  FTUE_STORAGE_KEY,
  FTUE_VERSION,
  useFtueStore,
} from '@/features/onboarding';
import { useProgression } from '@/features/progression/store';
import { useScores } from '@/features/scores';
import { useStreak } from '@/features/streak';

import { getSavedAdventureSummary, getSavedGameSummary, hasSavedGame, useGameStore } from '../store';

const dot = SHAPES_BY_ID.get('dot')!;
const sq3 = SHAPES_BY_ID.get('sq3')!;

function installLegacyClassic(raw: string): void {
  removeKey(KEYS.classicRunEnvelope);
  removeKey(KEYS.classicRunMeta);
  setString(KEYS.gameCurrent, raw);
}

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
      waveNumber: 3,
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
      waveNumber: 0,
      status: 'playing',
      reviveUsed: false,
      rngState: 11,
    },
    linesCleared: 0,
    finalResult: null,
    lastEvent: null,
  });
}

function setNearLineClear(score = 0): void {
  const board = emptyBoard();
  for (let c = 0; c < 7; c += 1) board[idx(0, c)] = 1;
  useGameStore.setState({
    game: {
      board,
      tray: [
        { shape: dot, colorId: 2 },
        { shape: dot, colorId: 3 },
        { shape: dot, colorId: 4 },
      ],
      score,
      combo: 0,
      movesSinceClear: 0,
      waveNumber: 1,
      status: 'playing',
      reviveUsed: false,
      rngState: 17,
    },
    linesCleared: 0,
    finalResult: null,
    lastEvent: null,
  });
}

beforeEach(() => {
  removeKey(KEYS.gameCurrent);
  removeKey(KEYS.classicRunMeta);
  removeKey(KEYS.classicRunEnvelope);
  removeKey(KEYS.classicRunArchive);
  removeKey(KEYS.adventureRun);
  removeKey(KEYS.adventureRunArchive);
  removeKey(KEYS.leaderboardActiveProof);
  removeKey(KEYS.leaderboardRuns);
  removeKey(KEYS.leaderboardSnapshot);
  removeKey(KEYS.leaderboardDaily);
  removeKey(KEYS.leaderboardPending);
  removeKey(KEYS.leaderboardTickets);
  removeKey(KEYS.analyticsQueue);
  removeKey(KEYS.analyticsPrefs);
  removeKey(KEYS.progression);
  removeKey(KEYS.adventure);
  removeKey(FTUE_STORAGE_KEY);
  useAnalyticsStore.setState({ queue: [], optOut: false });
  useScores.setState({ best: 0, gamesPlayed: 0, totalLinesCleared: 0, settledRuns: {} });
  useProgression.setState({
    lifetimePoints: 0,
    level: 1,
    world: 1,
    unlockedThemes: ['classic'],
    activeTheme: 'classic',
    claimedRewards: [],
    appliedSettlements: [],
    rewardReceipts: {},
    reveal: null,
    revealQueue: [],
  });
  useAdventure.getState().reset();
  useStreak.setState({ lastDay: null, count: 0 });
  useLeaderboardStore.getState().resetForTests({
    nickname: 'LimeComet',
    normalizedNickname: 'limecomet',
    tag: '00H',
    seed: 7,
  });
  useFtueStore.setState({
    version: FTUE_VERSION,
    status: 'not_started',
    variant: 'control',
    metricVersion: FTUE_METRIC_VERSION,
    startedAt: null,
    placements: 0,
    invalidDrops: 0,
    completedAt: null,
    skipReason: null,
    runId: null,
    guidedClearAt: null,
    acceptedMovesAfterFixture: 0,
    movesSinceLastClear: 0,
    invalidDropsSinceLastClear: 0,
    assistanceActive: false,
    assistanceUsedSinceLastClear: false,
    practicePromptVisible: false,
    metricWindowClosed: false,
    outcome: null,
  });
  useGameStore.getState().newGame();
});

describe('saved run lifecycle', () => {
  it('restores the tutorial board and FTUE phase from one checkpoint', () => {
    const tutorial = createTutorialGame(0x46545545);
    useGameStore.getState().newGame({ initialGame: tutorial, seed: 0x46545545 });
    const runId = useGameStore.getState().classicMeta!.runId;

    const assertRestored = (expectedGame = useGameStore.getState().game) => {
      const expectedStatus = useFtueStore.getState().status;
      useGameStore.setState({ game: { ...expectedGame, score: 999 } });
      useFtueStore.setState({ status: 'clear_line' });
      expect(useGameStore.getState().loadSaved()).toBe('active');
      expect(useGameStore.getState().game).toEqual(expectedGame);
      expect(useFtueStore.getState().runId).toBe(runId);
      expect(useFtueStore.getState().status).toBe(expectedStatus);
    };

    assertRestored();
    useFtueStore.getState().recordGrab();
    useGameStore.getState().syncTutorialCheckpoint();
    assertRestored();
    expect(useGameStore.getState().placePiece(2, 3, 3)).not.toBeNull();
    const afterClear = useGameStore.getState().game;
    expect(useFtueStore.getState().status).toBe('guided_success');
    assertRestored(afterClear);
  });

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

  it('does not treat the first positive score as a mid-run record celebration', () => {
    useScores.setState({ best: 0, gamesPlayed: 0, totalLinesCleared: 0 });
    useGameStore.getState().newGame({ seed: 11 });
    setDotRun(0);

    expect(useGameStore.getState().placePiece(0, 0, 0)).not.toBeNull();
    expect(useGameStore.getState().recordCelebration).toBeNull();
    expect(useGameStore.getState().recordCelebrated).toBe(false);

    expect(useGameStore.getState().placePiece(1, 0, 1)).not.toBeNull();
    expect(useGameStore.getState().recordCelebration).toBeNull();
    expect(useGameStore.getState().recordCelebrated).toBe(false);
  });

  it('loads a saved run without replaying a historical crossing', () => {
    useScores.setState({ best: 10, gamesPlayed: 0, totalLinesCleared: 0 });

    installLegacyClassic(
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
        waveNumber: 3,
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

    installLegacyClassic(
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
        waveNumber: 3,
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
    expect(getSavedGameSummary()).toMatchObject({
      mode: 'classic', kind: 'active', score: 0, canContinue: true,
    });

    const active = useGameStore.getState().game;
    installLegacyClassic(
      serialize({ ...active, status: 'over', score: 321, reviveUsed: false }),
    );
    removeKey(KEYS.classicRunMeta);
    expect(getSavedGameSummary()).toEqual(expect.objectContaining({
      kind: 'terminal_final',
      score: 321,
      canContinue: false,
    }));

    installLegacyClassic(
      serialize({ ...active, status: 'over', score: 654, reviveUsed: true }),
    );
    removeKey(KEYS.classicRunMeta);
    expect(getSavedGameSummary()).toEqual(expect.objectContaining({
      kind: 'terminal_final',
      score: 654,
      canContinue: false,
    }));

    removeKey(KEYS.gameCurrent);
    removeKey(KEYS.classicRunEnvelope);
    removeKey(KEYS.classicRunMeta);
    expect(getSavedGameSummary()).toEqual(expect.objectContaining({ kind: 'none', score: null, canContinue: false }));

    installLegacyClassic('{broken');
    expect(getSavedGameSummary()).toEqual(expect.objectContaining({ kind: 'none', score: null, canContinue: false }));
    expect(getString(KEYS.gameCurrent)).toBeNull();
  });

  it('loads active, revivable terminal, and final terminal saves without creating a new run', () => {
    useGameStore.getState().placePiece(0, 3, 3);
    const active = serialize(useGameStore.getState().game);
    useGameStore.getState().newGame();
    installLegacyClassic(active);
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
    installLegacyClassic(serialize(terminal));
    const proofBeforeTerminalLoad = useLeaderboardStore.getState().activeProof;
    expect(useGameStore.getState().loadSaved()).toBe('terminal');
    expect(useGameStore.getState().game).toEqual(terminal);
    expect(useGameStore.getState().lastEvent).toBeNull();
    expect(useGameStore.getState().finalResult).toBeNull();
    expect(useLeaderboardStore.getState().activeProof).toEqual(proofBeforeTerminalLoad);

    const finalTerminal = {
      ...terminal,
      score: 901,
      reviveUsed: true,
    };
    installLegacyClassic(serialize(finalTerminal));
    const proofBeforeFinalTerminalLoad = useLeaderboardStore.getState().activeProof;
    expect(useGameStore.getState().loadSaved()).toBe('terminal');
    expect(useGameStore.getState().game).toEqual(finalTerminal);
    expect(useGameStore.getState().lastEvent).toBeNull();
    expect(useGameStore.getState().finalResult).toBeNull();
    expect(useLeaderboardStore.getState().activeProof).toEqual(proofBeforeFinalTerminalLoad);
    expect(useProgression.getState().lifetimePoints).toBe(0);
    expect(useProgression.getState().rewardReceipts).toEqual({});
  });

  it('uses a dedicated unique run id even for identical seed and start timestamp', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(123_456);
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    useGameStore.getState().newGame({ seed: 7 });
    const first = useGameStore.getState().classicMeta!.runId;
    useGameStore.getState().newGame({ seed: 7 });
    const second = useGameStore.getState().classicMeta!.runId;
    now.mockRestore();
    random.mockRestore();

    expect(second).not.toBe(first);
  });

  it('removes a corrupt save without replacing the live run', () => {
    const gameBefore = serialize(useGameStore.getState().game);
    const proofBefore = useLeaderboardStore.getState().activeProof;
    installLegacyClassic('{broken');

    expect(useGameStore.getState().loadSaved()).toBeNull();
    expect(serialize(useGameStore.getState().game)).toBe(gameBefore);
    expect(useLeaderboardStore.getState().activeProof).toEqual(proofBefore);
    expect(getString(KEYS.gameCurrent)).toBeNull();
    expect(getString(KEYS.classicRunArchive)).toContain('corrupt');
  });
});

describe('Game Over and Continue accounting', () => {
  it('persists the first terminal result and accounts for it once', () => {
    setNearGameOver(777);

    const event = useGameStore.getState().placePiece(0, 0, 0)!;

    expect(event.gameOver).toBe(true);
    expect(useGameStore.getState().finalResult).toEqual({ newRecord: true, delta: 778 });
    expect(useGameStore.getState().classicMeta?.lifecycle).toBe('terminal_revivable');
    expect(useScores.getState().gamesPlayed).toBe(1);
    expect(useScores.getState().best).toBe(778);
    expect(useStreak.getState().count).toBe(0);
    expect(deserialize(getString(KEYS.gameCurrent)!)).toEqual(useGameStore.getState().game);
    expect(getSavedGameSummary()).toEqual(expect.objectContaining({
      kind: 'terminal_revivable',
      score: 778,
      canContinue: true,
    }));
    expect(useAnalyticsStore.getState().queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'game_over',
          properties: {
            score: 778,
            linesCleared: 4,
            revived: false,
            sessionDepth: 1,
          },
        }),
      ]),
    );
  });

  it('finalizes an already-settled revivable terminal without paying it twice', () => {
    setNearGameOver(400);
    useGameStore.getState().placePiece(0, 0, 0);

    expect(useScores.getState().gamesPlayed).toBe(1);
    expect(useGameStore.getState().classicMeta?.lifecycle).toBe('terminal_revivable');

    const first = useGameStore.getState().settleClassicRun('home');
    const second = useGameStore.getState().settleClassicRun('home');

    expect(first).toEqual({ newRecord: true, delta: 401 });
    expect(second).toEqual(first);
    expect(useScores.getState().gamesPlayed).toBe(1);
    expect(useGameStore.getState().classicMeta?.lifecycle).toBe('terminal_final');
    expect(useAnalyticsStore.getState().queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'duplicate_reward_count' }),
    ]));
  });

  it('restores a pending terminal after process death and settles it without duplication', () => {
    setNearGameOver(600);
    useGameStore.getState().placePiece(0, 0, 0);
    const envelope = getString(KEYS.classicRunEnvelope);

    useGameStore.getState().newGame({ seed: 99 });
    setString(KEYS.classicRunEnvelope, envelope!);
    useGameStore.setState({ classicMeta: null, finalResult: null });

    expect(useGameStore.getState().loadSaved()).toBe('terminal');
    expect(useGameStore.getState().classicMeta?.lifecycle).toBe('terminal_revivable');
    useGameStore.getState().settleClassicRun('home');
    useGameStore.getState().settleClassicRun('home');
    expect(useScores.getState()).toMatchObject({ gamesPlayed: 1, best: 601 });
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
    expect(useAnalyticsStore.getState().queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'revive_used',
          properties: { result: 'continued' },
        }),
      ]),
    );

    useGameStore.setState({ game: { ...continued, status: 'over' } });
    expect(useGameStore.getState().continueGame()).toBe(false);
    expect(useGameStore.getState().game.status).toBe('over');
  });

  it('freezes ranked and game-count accounting at first Game Over', () => {
    useLeaderboardStore.setState({
      tickets: [{ ticketId: 'ticket-1', seed: 5, expiresAt: '2099-06-20T00:00:00.000Z' }],
    });
    useGameStore.getState().newGame();
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
    expect(useStreak.getState().count).toBe(0);
    // Локальный недельный best поднят, без второй ПАРТИИ (runsCount не растёт).
    expect(useLeaderboardStore.getState().localWeeklyResult).toMatchObject({
      bestScore: 1501,
      runsCount: 1,
    });
    expect(getSavedGameSummary()).toEqual(expect.objectContaining({
      kind: 'terminal_final',
      score: 1501,
      canContinue: false,
    }));
  });

  it('cold-loading a terminal save does not repeat accounting', () => {
    setNearGameOver(500);
    useGameStore.getState().placePiece(0, 0, 0);
    const terminalEnvelope = getString(KEYS.classicRunEnvelope)!;
    const stats = useScores.getState();
    const streak = useStreak.getState();
    const pending = useLeaderboardStore.getState().pendingSubmissions;

    useGameStore.getState().newGame();
    setString(KEYS.classicRunEnvelope, terminalEnvelope);
    expect(useGameStore.getState().loadSaved()).toBe('terminal');

    expect(useScores.getState().gamesPlayed).toBe(stats.gamesPlayed);
    expect(useScores.getState().best).toBe(stats.best);
    expect(useStreak.getState().count).toBe(streak.count);
    expect(useLeaderboardStore.getState().pendingSubmissions).toEqual(pending);
    expect(useGameStore.getState().lastEvent).toBeNull();
    expect(useGameStore.getState().finalResult).toEqual({ newRecord: true, delta: 501 });
  });

  it('awards only the improved XP delta after remount, resume, and revive', () => {
    setNearGameOver(999);
    useGameStore.getState().placePiece(0, 0, 0);
    const checkpoint = getString(KEYS.classicRunEnvelope)!;
    expect(useProgression.getState().lifetimePoints).toBe(1_000);
    const persistedProgression = getJSON<ReturnType<typeof useProgression.getState>>(KEYS.progression)!;

    useGameStore.getState().newGame({ seed: 77 });
    setString(KEYS.classicRunEnvelope, checkpoint);
    useProgression.setState({ ...persistedProgression, reveal: null, revealQueue: [] });
    useGameStore.setState({ classicMeta: null, finalResult: null });
    expect(useGameStore.getState().loadSaved()).toBe('terminal');
    expect(useGameStore.getState().continueGame()).toBe(true);

    setNearGameOver(1_499, true);
    useGameStore.getState().placePiece(0, 0, 0);
    expect(useProgression.getState().lifetimePoints).toBe(1_500);
    expect(useScores.getState().gamesPlayed).toBe(1);
  });

  it('restores checkpoint counters and the original generator configuration', () => {
    const originalConfig = useGameStore.getState().activeConfig;
    const meta = useGameStore.getState().classicMeta!;
    useGameStore.setState({
      linesCleared: 7,
      classicMeta: { ...meta, linesCleared: 7, placements: 11 },
    });
    useGameStore.getState().restoreGame(useGameStore.getState().game);
    useScores.setState({ gamesPlayed: 99 });
    useGameStore.setState({ linesCleared: 0, activeConfig: { ...originalConfig, colors: 99 } });

    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(useGameStore.getState().linesCleared).toBe(7);
    expect(useGameStore.getState().classicMeta?.placements).toBe(11);
    expect(useGameStore.getState().activeConfig).toEqual(originalConfig);
    expect(useAnalyticsStore.getState().queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'checkpoint_recovery' }),
      expect.objectContaining({
        name: 'checkpoint_counter_mismatch',
        properties: expect.objectContaining({ counter: 'placements' }),
      }),
    ]));
  });

  it('folds active time into the checkpoint when app activity pauses', () => {
    const startedAt = useGameStore.getState().classicMeta!.activeSinceAt!;
    const now = jest.spyOn(Date, 'now').mockReturnValue(startedAt + 2_500);

    useGameStore.getState().pauseClassicActivity();
    expect(useGameStore.getState().classicMeta).toMatchObject({
      activeDurationMs: expect.any(Number),
      activeSinceAt: null,
    });
    expect(useGameStore.getState().classicMeta!.activeDurationMs).toBeGreaterThanOrEqual(2_500);

    useGameStore.setState({ classicMeta: null });
    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(useGameStore.getState().classicMeta!.activeDurationMs).toBeGreaterThanOrEqual(2_500);
    now.mockRestore();
  });

  it('reattaches cold-resume analytics to the checkpoint run and counters', () => {
    const meta = useGameStore.getState().classicMeta!;
    useGameStore.setState({
      linesCleared: 7,
      classicMeta: { ...meta, linesCleared: 7, placements: 12, activeDurationMs: 3_000 },
    });
    useGameStore.getState().restoreGame(useGameStore.getState().game);
    useAnalyticsStore.getState().startRun('classic', 'new', 'wrong-run');

    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(useAnalyticsStore.getState().activeRun).toMatchObject({
      run_id: meta.runId,
      placements: 12,
      lines: 7,
    });
    expect(useAnalyticsStore.getState().activeRun!.active_duration_ms)
      .toBeGreaterThanOrEqual(3_000);
  });

  it('recovers a crash between result intent and atomic reward receipt', () => {
    const progression = useProgression.getState();
    const grant = jest.spyOn(progression, 'grantReward').mockImplementationOnce(() => {
      throw new Error('simulated interruption');
    });
    setNearGameOver(999);
    expect(() => useGameStore.getState().placePiece(0, 0, 0)).toThrow('simulated interruption');
    expect(useGameStore.getState().classicMeta?.settlement?.phase).toBe('pending');
    expect(useProgression.getState().lifetimePoints).toBe(0);
    grant.mockRestore();

    useGameStore.setState({ classicMeta: null, finalResult: null });
    expect(useGameStore.getState().loadSaved()).toBe('terminal');
    expect(useProgression.getState().lifetimePoints).toBe(1_000);
    expect(useGameStore.getState().classicMeta?.settlement?.phase).toBe('complete');

    useGameStore.getState().settleClassicRun('final_game_over');
    expect(useProgression.getState().lifetimePoints).toBe(1_000);
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
    useGameStore.setState({ game: before, classicMeta: null });
    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(useGameStore.getState().game).toEqual(after);
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
    useGameStore.setState({ classicMeta: null });
    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(serialize(useGameStore.getState().game)).toBe(snapStr);
  });
});

// --- Adventure-ран: жизненный цикл рядом с Endless-партией (спека 17, FR-7) ---

describe('adventure run lifecycle in game store', () => {
  const adventureSpec = {
    id: 's1-l1',
    seasonId: 1,
    levelIndex: 0,
    seed: 4242,
    objective: { type: 'score', target: 50 },
  } as const;

  it('keeps Classic and Adventure snapshots independent while switching modes', () => {
    useGameStore.getState().newGame({ seed: 77 });
    const classic = getString(KEYS.gameCurrent);
    useGameStore.getState().newAdventureGame(adventureSpec);
    const adventure = getString(KEYS.adventureRun);

    useGameStore.getState().newGame({ seed: 88 });

    expect(getString(KEYS.adventureRun)).toBe(adventure);
    expect(getString(KEYS.gameCurrent)).not.toBe(classic);
    expect(useGameStore.getState().resumeSavedAdventure(adventureSpec)).not.toBeNull();
  });

  it('loadSaved detaches the adventure run but keeps its snapshot for resume', () => {
    useGameStore.getState().newAdventureGame(adventureSpec);
    expect(useGameStore.getState().adventure).not.toBeNull();
    expect(getString(KEYS.adventureRun)).toBeTruthy();

    expect(useGameStore.getState().loadSaved()).toBe('active');

    // Endless-партия загружена, ходы больше не уходят в adventure-ветку.
    expect(useGameStore.getState().adventure).toBeNull();
    // Снапшот уровня остаётся — FR-7 восстановит его при входе на экран уровня.
    expect(getString(KEYS.adventureRun)).toBeTruthy();
  });

  it('restoreGame detaches the adventure run', () => {
    const snapshot = useGameStore.getState().game;
    useGameStore.getState().newAdventureGame(adventureSpec);

    useGameStore.getState().restoreGame(snapshot);

    expect(useGameStore.getState().adventure).toBeNull();
    expect(getString(KEYS.gameCurrent)).toBe(serialize(snapshot));
  });

  it('suspendAdventure + resumeSavedAdventure restore the same mid-level run', () => {
    useGameStore.getState().newAdventureGame(adventureSpec, 2);
    const run = useGameStore.getState().adventure!;

    useGameStore.getState().suspendAdventure();
    expect(useGameStore.getState().adventure).toBeNull();
    expect(getString(KEYS.adventureRun)).toBeTruthy();

    const resumed = useGameStore.getState().resumeSavedAdventure(adventureSpec);
    expect(resumed).toEqual(run);
    expect(useGameStore.getState().adventure).toEqual(run);
    expect(useGameStore.getState().game).toEqual(run.game);
  });

  it('resumeSavedAdventure rejects a mismatched snapshot and clears it', () => {
    useGameStore.getState().newAdventureGame(adventureSpec);
    useGameStore.getState().suspendAdventure();

    const other = { ...adventureSpec, id: 's1-l2', levelIndex: 1 };
    expect(useGameStore.getState().resumeSavedAdventure(other)).toBeNull();
    expect(useGameStore.getState().adventure).toBeNull();
    expect(getString(KEYS.adventureRun)).toBeFalsy();
  });

  it.each(['won', 'failed'] as const)(
    'resumeSavedAdventure restores a cold terminal %s snapshot for settlement',
    (status) => {
      useGameStore.getState().newAdventureGame(adventureSpec, 3);
      const terminal = useGameStore.getState().adventure!;
      setString(
        KEYS.adventureRun,
        serializeAdventureRun({
          ...terminal,
          status,
        }),
      );
      useGameStore.setState({ adventure: null, lastAdventureEvent: null });

      expect(useGameStore.getState().resumeSavedAdventure(adventureSpec)).toMatchObject({ status });
      expect(useGameStore.getState().adventure).toMatchObject({ status });
      expect(getString(KEYS.adventureRun)).toBeTruthy();
    },
  );

  it('recovers the saved winning move before campaign/XP and settles it exactly once', () => {
    useGameStore.getState().newAdventureGame(adventureSpec, 0);
    const pending = {
      ...useGameStore.getState().adventure!,
      status: 'won' as const,
      outcomeSettledAt: null,
    };
    setString(KEYS.adventureRun, serializeAdventureRun(pending));
    useGameStore.setState({ adventure: null, lastAdventureEvent: null });

    const resumed = useGameStore.getState().resumeSavedAdventure(adventureSpec);
    const completionId = adventureCompletionIdentity(1, 0).completionId;

    expect(resumed).toMatchObject({ status: 'won', runId: pending.runId });
    expect(useAdventure.getState()).toMatchObject({ levelIndex: 1, consecutive: 1 });
    expect(useProgression.getState()).toMatchObject({ lifetimePoints: 500 });
    expect(useProgression.getState().rewardReceipts[`${completionId}::xp`]).toMatchObject({
      completionId,
      runId: pending.runId,
      source: 'adventure',
      grantedAmount: 500,
    });
    expect(deserializeAdventureRun(getString(KEYS.adventureRun)!)?.outcomeSettledAt)
      .toEqual(expect.any(Number));
    expect(useAnalyticsStore.getState().activeRun).toMatchObject({
      run_id: pending.runId,
      mode: 'adventure',
      terminal_reported: true,
    });

    useGameStore.getState().suspendAdventure();
    useGameStore.getState().resumeSavedAdventure({ ...adventureSpec, id: 's1-l2', levelIndex: 1 });
    expect(useAdventure.getState()).toMatchObject({ levelIndex: 1, consecutive: 1 });
    expect(useProgression.getState().lifetimePoints).toBe(500);
  });

  it('repairs XP after process death between campaign advance and the G03 receipt', () => {
    useGameStore.getState().newAdventureGame(adventureSpec, 0);
    const pending = {
      ...useGameStore.getState().adventure!,
      status: 'won' as const,
      outcomeSettledAt: null,
    };
    const completionId = adventureCompletionIdentity(1, 0).completionId;
    setString(KEYS.adventureRun, serializeAdventureRun(pending));
    expect(
      useAdventure.getState().recordWinOnce(completionId, pending.runId, '2026-09-19'),
    ).toBe(true);
    expect(useProgression.getState().lifetimePoints).toBe(0);
    useGameStore.setState({ adventure: null, lastAdventureEvent: null });

    useGameStore.getState().resumeSavedAdventure({ ...adventureSpec, id: 's1-l2', levelIndex: 1 });

    expect(useAdventure.getState()).toMatchObject({ levelIndex: 1, consecutive: 1 });
    expect(useProgression.getState().lifetimePoints).toBe(500);
    expect(useProgression.getState().rewardReceipts[`${completionId}::xp`]).toBeDefined();
  });

  it('rebuilds the level-up reveal after death between the G03 receipt and reveal', () => {
    useProgression.setState({ lifetimePoints: 1_500, level: 1 });
    useGameStore.getState().newAdventureGame(adventureSpec, 0);
    const pending = {
      ...useGameStore.getState().adventure!,
      status: 'won' as const,
      outcomeSettledAt: null,
    };
    const completionId = adventureCompletionIdentity(1, 0).completionId;
    setString(KEYS.adventureRun, serializeAdventureRun(pending));
    useProgression.getState().grantReward({
      runId: pending.runId,
      completionId,
      rewardId: 'xp',
      source: 'adventure',
      targetAmount: 500,
    });
    useProgression.setState({ reveal: null, revealQueue: [] });
    useGameStore.setState({ adventure: null, lastAdventureEvent: null });

    useGameStore.getState().resumeSavedAdventure(adventureSpec);

    expect(useProgression.getState().lifetimePoints).toBe(2_000);
    expect(useProgression.getState().revealQueue).toEqual([
      expect.objectContaining({ runId: pending.runId, level: 2 }),
    ]);
    expect(useAdventure.getState().levelIndex).toBe(1);
  });

  it('uses completionId to prevent a second XP grant from another attempt/run', () => {
    const completionId = adventureCompletionIdentity(1, 0).completionId;
    useGameStore.getState().newAdventureGame(adventureSpec, 0);
    const first = { ...useGameStore.getState().adventure!, status: 'won' as const };
    useGameStore.setState({ adventure: first, game: first.game });
    useGameStore.getState().settleAdventureOutcome(first.runId);

    useGameStore.getState().newAdventureGame(adventureSpec, 1);
    const replay = { ...useGameStore.getState().adventure!, status: 'won' as const };
    useGameStore.setState({ adventure: replay, game: replay.game });
    useGameStore.getState().settleAdventureOutcome(replay.runId);

    expect(first.runId).not.toBe(replay.runId);
    expect(useProgression.getState().lifetimePoints).toBe(500);
    expect(useProgression.getState().rewardReceipts[`${completionId}::xp`]).toMatchObject({
      grantedAmount: 500,
      runId: first.runId,
    });
    expect(useAdventure.getState()).toMatchObject({ levelIndex: 1, consecutive: 1 });
  });

  it('settles the final personal-season win and preserves its result after cold resume', () => {
    const lastIndex = seasonLength(1) - 1;
    const finalSpec = levelFor(1, lastIndex);
    useAdventure.setState({ seasonId: 1, levelIndex: lastIndex });
    useGameStore.getState().newAdventureGame(finalSpec, 2);
    const pending = {
      ...useGameStore.getState().adventure!,
      status: 'won' as const,
      outcomeSettledAt: null,
    };
    setString(KEYS.adventureRun, serializeAdventureRun(pending));
    useGameStore.setState({ adventure: null, lastAdventureEvent: null });

    useGameStore.getState().resumeSavedAdventure(finalSpec);

    expect(useAdventure.getState()).toMatchObject({
      seasonId: 2,
      levelIndex: 0,
      trophies: expect.arrayContaining([1]),
    });
    expect(useProgression.getState().lifetimePoints).toBe(650);
    expect(useGameStore.getState().settleAdventureOutcome(pending.runId)).toMatchObject({
      completedSeason: 1,
      xpGranted: 650,
    });
  });

  it('exitAdventure suspends while explicit discard removes the snapshot', () => {
    useGameStore.getState().newAdventureGame(adventureSpec);

    useGameStore.getState().exitAdventure();

    expect(useGameStore.getState().adventure).toBeNull();
    expect(getString(KEYS.adventureRun)).toBeTruthy();
    expect(useGameStore.getState().resumeSavedAdventure(adventureSpec)).not.toBeNull();
    useGameStore.getState().discardAdventure();
    expect(getString(KEYS.adventureRun)).toBeFalsy();
  });

  it('persists per-level failure count and an explicit help choice across retry and cold resume', () => {
    useGameStore.getState().newAdventureGame(adventureSpec, 0);
    let run = useGameStore.getState().adventure!;
    useGameStore.setState({ adventure: { ...run, status: 'failed' } });
    useGameStore.getState().settleAdventureOutcome(run.runId);
    expect(useGameStore.getState().adventure).toMatchObject({
      status: 'failed',
      failureCount: 1,
    });

    useGameStore.getState().newAdventureGame(adventureSpec, 1, 'restart', 'declined');
    run = useGameStore.getState().adventure!;
    expect(run).toMatchObject({ failureCount: 1, helpPolicy: 'declined', helpUsed: false });
    useGameStore.getState().suspendAdventure();
    expect(useGameStore.getState().resumeSavedAdventure(adventureSpec)).toMatchObject({
      runId: run.runId,
      failureCount: 1,
      helpPolicy: 'declined',
    });
    useGameStore.setState({ adventure: { ...run, status: 'failed' } });
    useGameStore.getState().settleAdventureOutcome(run.runId);
    expect(useGameStore.getState().adventure?.failureCount).toBe(2);

    useGameStore.getState().newAdventureGame(adventureSpec, 2, 'restart', 'highlight');
    const assisted = useGameStore.getState().adventure!;
    expect(assisted).toMatchObject({
      failureCount: 2,
      helpPolicy: 'highlight',
      helpUsed: false,
    });
    useGameStore.getState().suspendAdventure();
    expect(useGameStore.getState().resumeSavedAdventure(adventureSpec)).toMatchObject({
      runId: assisted.runId,
      failureCount: 2,
      helpPolicy: 'highlight',
      helpUsed: false,
    });
  });

  it.each(['highlight', 'declined'] as const)(
    'commits retry policy %s before an external async boundary and carries it after process death',
    (policy) => {
      useGameStore.getState().newAdventureGame(adventureSpec, 1);
      const active = useGameStore.getState().adventure!;
      const failed = {
        ...active,
        status: 'failed' as const,
        failureCount: 1,
      };
      useGameStore.setState({ adventure: failed, game: failed.game });
      useGameStore.getState().settleAdventureOutcome(failed.runId);

      expect(useGameStore.getState().setAdventureRetryPolicy(failed.runId, policy)).toBe(true);
      expect(deserializeAdventureRun(getString(KEYS.adventureRun)!)).toMatchObject({
        status: 'failed',
        failureCount: 2,
        helpPolicy: policy,
      });

      useGameStore.getState().suspendAdventure();
      expect(useGameStore.getState().resumeSavedAdventure(adventureSpec)).toMatchObject({
        runId: failed.runId,
        helpPolicy: policy,
      });
      useGameStore.getState().newAdventureGame(adventureSpec, 2, 'restart');
      expect(useGameStore.getState().adventure).toMatchObject({
        status: 'playing',
        failureCount: 2,
        helpPolicy: policy,
        helpUsed: false,
      });
    },
  );

  it('consumes the chosen highlight atomically with one valid move and preserves it on restart', () => {
    useGameStore.getState().newAdventureGame(adventureSpec, 2, 'restart', 'highlight');
    const firstRun = useGameStore.getState().adventure!;
    const trayIndex = firstRun.game.tray.findIndex((piece) => piece !== null);
    const piece = firstRun.game.tray[trayIndex]!;
    const [row, col] = (() => {
      for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
          if (piece.shape.cells.every(([dr, dc]) => r + dr < 8 && c + dc < 8)) return [r, c];
        }
      }
      throw new Error('expected placement');
    })();

    expect(useGameStore.getState().placePiece(trayIndex, row, col)).not.toBeNull();
    expect(useGameStore.getState().adventure).toMatchObject({
      helpPolicy: 'highlight',
      helpUsed: true,
    });
    expect(deserializeAdventureRun(getString(KEYS.adventureRun)!)).toMatchObject({
      helpPolicy: 'highlight',
      helpUsed: true,
    });

    useGameStore.getState().newAdventureGame(adventureSpec, 3, 'restart');
    expect(useGameStore.getState().adventure).toMatchObject({
      helpPolicy: 'highlight',
      helpUsed: false,
    });
  });

  it('resets consecutive level failures after a settled win', () => {
    useGameStore.getState().newAdventureGame(adventureSpec, 2, 'restart', 'declined');
    const run = {
      ...useGameStore.getState().adventure!,
      failureCount: 2,
      status: 'won' as const,
    };
    useGameStore.setState({ adventure: run, game: run.game });

    useGameStore.getState().settleAdventureOutcome(run.runId);

    expect(useGameStore.getState().adventure).toMatchObject({
      status: 'won',
      failureCount: 0,
    });
  });

  it('migrates an already-accounted legacy terminal win without replaying it', () => {
    useGameStore.getState().newAdventureGame(adventureSpec);
    const terminal = { ...useGameStore.getState().adventure!, status: 'won' as const };
    const legacy = JSON.parse(serializeAdventureRun(terminal)) as Record<string, unknown>;
    legacy.v = 1;
    delete legacy.runId;
    delete legacy.outcomeSettledAt;
    setString(KEYS.adventureRun, JSON.stringify(legacy));
    setJSON(KEYS.adventure, { seasonId: 1, levelIndex: 1 });
    useGameStore.setState({ adventure: null, lastAdventureEvent: null });

    expect(getSavedAdventureSummary()).toMatchObject({ kind: 'terminal', status: 'won' });
    expect(deserializeAdventureRun(getString(KEYS.adventureRun)!)?.outcomeSettledAt).toBe(1);
  });
});

// --- Дейли-активация: первая позитивная очистка дня (retention FTUE rework) ---

describe('streak activation on a positive clear', () => {
  it('marks the day immediately on the first line clear', () => {
    setNearLineClear();

    const event = useGameStore.getState().placePiece(0, 0, 7)!;

    expect(event.gameOver).toBe(false);
    expect(event.clearedRows).toEqual([0]);
    expect(useStreak.getState().count).toBe(1);
  });

  it('tracks only the record stages actually entered by successful placements', () => {
    useScores.setState({ best: 2_000, gamesPlayed: 3, totalLinesCleared: 0 });
    useGameStore.getState().newGame({ seed: 19 });

    setDotRun(1_640);
    expect(useGameStore.getState().placePiece(0, 0, 0)).not.toBeNull();
    setDotRun(1_880);
    expect(useGameStore.getState().placePiece(0, 0, 0)).not.toBeNull();
    setDotRun(2_000);
    expect(useGameStore.getState().placePiece(0, 0, 0)).not.toBeNull();

    const recordEvents = useAnalyticsStore
      .getState()
      .queue.filter((event) => event.name === 'record_progressed');
    expect(recordEvents.map((event) => event.properties)).toEqual([
      expect.objectContaining({ stage: 'pursuit', score: 1_641, best_at_start: 2_000 }),
      expect.objectContaining({ stage: 'near', score: 1_881, best_at_start: 2_000 }),
      expect.objectContaining({ stage: 'broken', score: 2_001, best_at_start: 2_000 }),
    ]);
  });

  it('does not mark the day after a loss without a clear', () => {
    setNearGameOver(777);
    useGameStore.setState({ linesCleared: 0 });

    const event = useGameStore.getState().placePiece(0, 0, 0)!;

    expect(event.gameOver).toBe(true);
    expect(event.clearedRows).toHaveLength(0);
    expect(event.clearedCols).toHaveLength(0);
    expect(useStreak.getState().count).toBe(0);
  });

  it('keeps the streak idempotent across later clears on the same day', () => {
    setNearLineClear();
    useGameStore.getState().placePiece(0, 0, 7);

    setNearLineClear(100);
    useGameStore.getState().placePiece(0, 0, 7);

    expect(useStreak.getState().count).toBe(1);
  });
});
