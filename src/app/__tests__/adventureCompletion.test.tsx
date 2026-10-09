import React from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { deserializeAdventureRun, emptyBoard, SHAPES_BY_ID } from '@/core/engine';
import { KEYS, getString, removeKey } from '@/core/storage';
import { levelFor } from '@/features/adventure/logic/levels';
import { adventureCompletionIdentity } from '@/features/adventure/logic/xp';
import { seasonLength } from '@/features/adventure/logic/seasons';
import { useAdventure } from '@/features/adventure/store';
import { EFFECT_SEQUENCE_TIMING } from '@/features/game/animation/effectSequence';
import { useGameStore } from '@/features/game/store';
import { rewardReceiptKey, useProgression } from '@/features/progression/store';

import AdventureLevelScreen from '../adventure-level';

const mockBoardMount = jest.fn();
const mockBoardUnmount = jest.fn();
const mockResultMount = jest.fn();
const mockLevelUpMount = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@/features/game/sound/feedback', () => ({ playPlacementFeedback: jest.fn() }));
jest.mock('@/features/game/animation/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('@/features/onboarding', () => jest.requireActual('@/features/onboarding/ftueStore'));
jest.mock('@/features/profile', () => {
  const state = { authToken: null, bootstrapRemote: async () => null };
  return { useProfileStore: (selector: (value: typeof state) => unknown) => selector(state) };
});
jest.mock('@/features/notifications', () => ({ recordMeaningfulSessionForPush: jest.fn() }));
jest.mock('@/features/mascot', () => ({ useMascot: { getState: () => ({ unlock: jest.fn() }) } }));
jest.mock('@/features/monetization', () => ({
  GameBannerDock: () => null,
  MONETIZATION: { adsEnabled: false },
  evaluateInterstitialOpportunity: () => ({
    variant: 'control',
    baseEligible: false,
    shouldRequest: false,
    decision: 'frequency_policy',
    telemetry: null,
  }),
  getAds: jest.fn(),
  loadAdsMeta: () => ({}),
  recordAdventureFail: jest.fn(),
  recordAdventureLevelWin: jest.fn(),
  recordInterstitialShown: jest.fn(),
  saveAdsMeta: jest.fn(),
  shouldShowInterstitial: () => false,
  useEntitlements: (selector: (value: { removeAds: boolean }) => unknown) => selector({ removeAds: true }),
}));
jest.mock('@/ui', () => ({
  ...jest.requireActual('@/ui/theme'),
  AppText: 'AppText',
  ConfirmDialog: 'ConfirmDialog',
  GearIcon: () => null,
}));
jest.mock('@/features/game/components/PauseOverlay', () => ({ PauseOverlay: 'PauseOverlay' }));
jest.mock('@/features/game', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  return {
    ...jest.requireActual('@/features/game/animation/effectSequence'),
    ...jest.requireActual('@/features/game/playfield-layout'),
    ...jest.requireActual('@/features/game/store'),
    DragProvider: ({ children }: { children: React.ReactNode }) => children,
    BoardView: () => {
      ReactModule.useEffect(() => {
        mockBoardMount();
        return () => { mockBoardUnmount(); };
      }, []);
      return ReactModule.createElement('AdventureBoard', { testID: 'adventure-board' });
    },
    TrayView: () => null,
    PraiseBanner: () => null,
    InvalidDropNotice: () => null,
    EMPTY_MASK: new Array(64).fill(0),
    previewMask: () => new Array(64).fill(0),
    useDelayedTray: (tray: unknown) => tray,
    useGameFeedback: () => ({ onGrab: jest.fn(), onInvalidDrop: jest.fn() }),
    useInvalidDropNotice: () => ({
      message: null,
      report: jest.fn(),
      recordValidDrop: jest.fn(),
    }),
  };
});
jest.mock('@/features/adventure', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  return {
    ...jest.requireActual('@/features/adventure/store'),
    ...jest.requireActual('@/features/adventure/logic/levels'),
    ...jest.requireActual('@/features/adventure/logic/seasons'),
    ...jest.requireActual('@/features/adventure/logic/skins'),
    ...jest.requireActual('@/features/adventure/logic/xp'),
    ...jest.requireActual('@/features/adventure/logic/failure'),
    useSeasonWindowRefresh: () => {},
    seasonRewardCosmetic: () => null,
    JewelBoardLayer: () => null,
    JewelCollectionFlightLayer: () => null,
    JewelIcon: () => null,
    ObjectivePanel: () => null,
    FailOverlay: (props: object) => ReactModule.createElement('AdventureFailure', { ...props, testID: 'adventure-failure' }),
    LevelResultView: (props: object) => {
      ReactModule.useEffect(() => { mockResultMount(); }, []);
      return ReactModule.createElement('AdventureResult', { ...props, testID: 'adventure-result' });
    },
    LevelUpBanner: () => {
      ReactModule.useEffect(() => { mockLevelUpMount(); }, []);
      return ReactModule.createElement('AdventureLevelUp');
    },
  };
});

const newAdventureGame = useGameStore.getState().newAdventureGame;
const recordWinOnce = useAdventure.getState().recordWinOnce;
const mockNewAdventureGame = jest.fn(newAdventureGame);
const mockRecordWin = jest.fn(recordWinOnce);
const minimumSettlementMs = EFFECT_SEQUENCE_TIMING.adventureOutcomeReadyMs;

let tree: ReactTestRenderer | null;

function renderLevel(): ReactTestRenderer {
  let rendered!: ReactTestRenderer;
  act(() => { rendered = create(<AdventureLevelScreen />); });
  tree = rendered;
  return rendered;
}

function setUpWinningClear(): void {
  const run = useGameStore.getState().adventure!;
  const board = emptyBoard();
  for (let col = 0; col < 7; col += 1) board[col] = 1;
  const dot = { shape: SHAPES_BY_ID.get('dot')!, colorId: 1 };
  const game = {
    ...run.game,
    board,
    tray: [dot, dot, dot],
    score: run.level.objective.target - 1,
  };
  useGameStore.setState({
    game,
    adventure: {
      ...run,
      game,
      jewelsOnBoard: [0],
      collectedJewels: run.level.objective.type === 'jewels' ? run.level.objective.target - 1 : 0,
    },
  });
}

function winLevel() {
  let event: ReturnType<typeof useGameStore.getState>['lastEvent'] = null;
  act(() => {
    event = useGameStore.getState().placePiece(0, 0, 7);
    expect(event?.clearedRows).toEqual([0]);
    expect(useGameStore.getState().adventure?.status).toBe('won');
  });
  return event;
}

describe('adventure level completion presentation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    tree = null;
    removeKey(KEYS.adventureRun);
    removeKey(KEYS.progression);
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
    useAdventure.setState({ recordWinOnce: mockRecordWin });
    useGameStore.setState({ newAdventureGame: mockNewAdventureGame });
    newAdventureGame(levelFor(1, 0), 0);
    setUpWinningClear();
  });

  afterEach(() => {
    if (tree) act(() => { tree!.unmount(); });
    useGameStore.setState({ newAdventureGame });
    useAdventure.setState({ recordWinOnce });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps the winning board and clear event until a single result appears, then starts the next level once', async () => {
    const rendered = renderLevel();
    const board = rendered.root.findByProps({ testID: 'adventure-board' });
    const epoch = useGameStore.getState().epoch;
    const event = winLevel();

    expect(mockRecordWin).toHaveBeenCalledTimes(1);
    const wonRunId = useGameStore.getState().adventure!.runId;
    const completionId = adventureCompletionIdentity(1, 0).completionId;
    expect(useProgression.getState().rewardReceipts[rewardReceiptKey(completionId, 'xp')]).toMatchObject({
      runId: wonRunId,
      completionId,
      source: 'adventure',
      grantedAmount: 500,
    });
    expect(useAdventure.getState().levelIndex).toBe(1);
    expect(useAdventure.getState().consecutive).toBe(1);
    expect(mockNewAdventureGame).not.toHaveBeenCalled();
    expect(useGameStore.getState().adventure?.status).toBe('won');
    expect(useGameStore.getState().adventure?.level.levelIndex).toBe(0);
    expect(useGameStore.getState().lastEvent).toBe(event);
    expect(useGameStore.getState().epoch).toBe(epoch);
    expect(rendered.root.findByProps({ testID: 'adventure-board' })).toBe(board);
    expect(mockBoardUnmount).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(minimumSettlementMs - 1); });
    expect(rendered.root.findAllByProps({ testID: 'adventure-result' })).toHaveLength(0);
    expect(mockBoardUnmount).not.toHaveBeenCalled();
    expect(mockLevelUpMount).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(1_500); });
    const firstResult = rendered.root.findByProps({ testID: 'adventure-result' });
    expect(firstResult.props.completionId).toBe('adventure:personal:s1:l1');
    expect(firstResult.props.completedSeason).toBeNull();
    expect(mockResultMount).toHaveBeenCalledTimes(1);
    expect(mockLevelUpMount).not.toHaveBeenCalled();
    expect(mockRecordWin).toHaveBeenCalledTimes(1);
    expect(mockNewAdventureGame).not.toHaveBeenCalled();
    expect(rendered.root.findByProps({ testID: 'adventure-board' })).toBe(board);
    expect(useGameStore.getState().lastEvent).toBe(event);
    expect(useGameStore.getState().epoch).toBe(epoch);
    expect(mockBoardUnmount).not.toHaveBeenCalled();

    await act(async () => { rendered.root.findByProps({ testID: 'adventure-result' }).props.onNext(); });
    expect(mockNewAdventureGame).toHaveBeenCalledTimes(1);
    expect(mockNewAdventureGame).toHaveBeenCalledWith(levelFor(1, 1), 0, 'next');
    expect(useGameStore.getState().adventure).toMatchObject({
      status: 'playing', attempt: 0, level: { seasonId: 1, levelIndex: 1 },
    });
    expect(rendered.root.findAllByProps({ testID: 'adventure-result' })).toHaveLength(0);
    expect(mockRecordWin).toHaveBeenCalledTimes(1);
  });

  it('finishes a season on its winning board and starts the new season only after Next', async () => {
    const lastLevelIndex = seasonLength(1) - 1;
    useAdventure.setState({ levelIndex: lastLevelIndex });
    newAdventureGame(levelFor(1, lastLevelIndex), 0);
    setUpWinningClear();
    const rendered = renderLevel();
    const board = rendered.root.findByProps({ testID: 'adventure-board' });
    const epoch = useGameStore.getState().epoch;
    const event = winLevel();

    expect(useAdventure.getState()).toMatchObject({
      seasonId: 2, levelIndex: 0, lastWinCompletedSeason: 1,
    });
    expect(mockRecordWin).toHaveBeenCalledTimes(1);
    expect(mockNewAdventureGame).not.toHaveBeenCalled();
    expect(useGameStore.getState().adventure).toMatchObject({
      status: 'won', level: { seasonId: 1, levelIndex: lastLevelIndex },
    });
    expect(useGameStore.getState().lastEvent).toBe(event);
    expect(useGameStore.getState().epoch).toBe(epoch);
    expect(rendered.root.findByProps({ testID: 'adventure-board' })).toBe(board);

    act(() => { jest.advanceTimersByTime(minimumSettlementMs - 1); });
    expect(rendered.root.findAllByProps({ testID: 'adventure-result' })).toHaveLength(0);
    expect(mockBoardUnmount).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(1_500); });
    const result = rendered.root.findByProps({ testID: 'adventure-result' });
    expect(result.props.completedLevel).toBe(seasonLength(1));
    expect(result.props.completionId).toBe(`adventure:personal:s1:l${seasonLength(1)}`);
    expect(result.props.completedSeason).toBe(1);
    expect(mockResultMount).toHaveBeenCalledTimes(1);
    expect(mockLevelUpMount).not.toHaveBeenCalled();
    expect(useAdventure.getState().lastWinCompletedSeason).toBe(1);

    await act(async () => { result.props.onNext(); });
    expect(mockNewAdventureGame).toHaveBeenCalledTimes(1);
    expect(mockNewAdventureGame).toHaveBeenCalledWith(levelFor(2, 0), 0, 'next');
    expect(useAdventure.getState().lastWinCompletedSeason).toBeNull();
    expect(useGameStore.getState().adventure).toMatchObject({
      status: 'playing', attempt: 0, level: { seasonId: 2, levelIndex: 0 },
    });
  });

  it('cancels the pending result when the screen unmounts during the winning clear', () => {
    renderLevel();
    const timersBeforeWin = jest.getTimerCount();
    winLevel();
    expect(jest.getTimerCount()).toBeGreaterThan(timersBeforeWin);

    act(() => { tree!.unmount(); });
    tree = null;
    expect(jest.getTimerCount()).toBe(timersBeforeWin);
    act(() => { jest.advanceTimersByTime(3_000); });
    expect(mockResultMount).not.toHaveBeenCalled();
    expect(mockLevelUpMount).not.toHaveBeenCalled();
  });

  it('retries a failed run on the same level with one new attempt', async () => {
    const rendered = renderLevel();
    act(() => {
      const run = useGameStore.getState().adventure!;
      useGameStore.setState({ adventure: { ...run, status: 'failed' } });
    });
    act(() => { jest.advanceTimersByTime(1_500); });
    const failure = rendered.root.findByProps({ testID: 'adventure-failure' });
    expect(failure.props).toMatchObject({
      objective: 'score',
      current: useGameStore.getState().adventure!.game.score,
      target: levelFor(1, 0).objective.target,
      remaining:
        levelFor(1, 0).objective.target - useGameStore.getState().adventure!.game.score,
      helpEligible: false,
    });

    await act(async () => { failure.props.onRetry(); });
    expect(mockNewAdventureGame).toHaveBeenCalledTimes(1);
    expect(mockNewAdventureGame).toHaveBeenCalledWith(levelFor(1, 0), 1, 'restart');
    expect(useGameStore.getState().adventure).toMatchObject({
      status: 'playing', attempt: 1, level: { seasonId: 1, levelIndex: 0 },
    });
    expect(useAdventure.getState().levelIndex).toBe(0);
    expect(mockRecordWin).not.toHaveBeenCalled();
    expect(rendered.root.findAllByProps({ testID: 'adventure-failure' })).toHaveLength(0);
  });

  it('offers explicit free help after the second early-level failure and persists the choice', async () => {
    const rendered = renderLevel();
    act(() => {
      const run = useGameStore.getState().adventure!;
      useGameStore.setState({
        adventure: {
          ...run,
          status: 'failed',
          failureCount: 2,
          outcomeSettledAt: Date.now(),
        },
      });
    });
    act(() => { jest.advanceTimersByTime(1_500); });
    const failure = rendered.root.findByProps({ testID: 'adventure-failure' });
    expect(failure.props.helpEligible).toBe(true);

    await act(async () => { failure.props.onRetryWithHelp(); });

    expect(mockNewAdventureGame).toHaveBeenCalledWith(
      levelFor(1, 0),
      1,
      'restart',
      'highlight',
    );
    expect(useGameStore.getState().adventure).toMatchObject({
      status: 'playing',
      failureCount: 2,
      helpPolicy: 'highlight',
      helpUsed: false,
    });
  });

  it('keeps settled failure history when exiting to the hub and reopening offline', () => {
    const rendered = renderLevel();
    act(() => {
      const run = useGameStore.getState().adventure!;
      const failed = {
        ...run,
        status: 'failed' as const,
        failureCount: 1,
        helpPolicy: 'declined' as const,
        outcomeSettledAt: null,
      };
      useGameStore.setState({ adventure: failed, game: failed.game });
      useGameStore.getState().settleAdventureOutcome(failed.runId);
    });
    act(() => { jest.advanceTimersByTime(1_500); });

    act(() => {
      rendered.root.findByProps({ testID: 'adventure-failure' }).props.onExit();
    });

    expect(mockReplace).toHaveBeenCalledWith('/adventure');
    expect(useGameStore.getState().adventure).toBeNull();
    expect(deserializeAdventureRun(getString(KEYS.adventureRun)!)).toMatchObject({
      status: 'failed',
      failureCount: 2,
      helpPolicy: 'declined',
    });
    let resumed: ReturnType<typeof useGameStore.getState>['adventure'] = null;
    act(() => {
      resumed = useGameStore.getState().resumeSavedAdventure(levelFor(1, 0));
    });
    expect(resumed).toMatchObject({
      status: 'failed',
      failureCount: 2,
      helpPolicy: 'declined',
    });
  });

  it('keeps a native playfield parent when Home disables input before navigation unmounts the screen', () => {
    const rendered = renderLevel();
    const playfield = rendered.root.findAllByType(View).find(
      (node) => node.props.onLayout && node.props.pointerEvents === 'auto',
    )!;
    // Fabric must not flatten this parent and then reparent its animated children
    // when exitAdventure switches pointerEvents to none during a native transition.
    expect(playfield.props.collapsable).toBe(false);

    const settings = rendered.root.findAll(
      (node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
    )[0];
    act(() => { settings.props.onPress(); });
    act(() => {
      rendered.root.findByType('PauseOverlay' as React.ElementType).props.onHome();
    });

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(useGameStore.getState().adventure).toBeNull();
    expect(playfield.props.pointerEvents).toBe('none');
    expect(playfield.props.collapsable).toBe(false);
    expect(mockNewAdventureGame).not.toHaveBeenCalled();
    expect(mockRecordWin).not.toHaveBeenCalled();
  });
});
