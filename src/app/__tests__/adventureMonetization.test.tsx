import React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { emptyBoard, SHAPES_BY_ID } from '@/core/engine';
import { KEYS, getJSON, setJSON, removeKey } from '@/core/storage';
import { levelFor } from '@/features/adventure/logic/levels';
import { useAdventure } from '@/features/adventure/store';
import { useGameStore } from '@/features/game/store';
import { useProgression } from '@/features/progression/store';

import { useAdPresentation } from '@/features/monetization/adPresentation';
import { EMPTY_ADS_META, type AdsMeta } from '@/features/monetization/frequency';

import AdventureLevelScreen from '../adventure-level';

const mockBoardMount = jest.fn();
const mockBoardUnmount = jest.fn();
const mockResultMount = jest.fn();
const mockLevelUpMount = jest.fn();
const mockReplace = jest.fn();
const mockShowInterstitial = jest.fn();
const mockPrepareInterstitial = jest.fn(async () => {});

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
jest.mock('@/features/monetization', () => {
  const storage = jest.requireActual('@/core/storage');
  const frequency = jest.requireActual('@/features/monetization/frequency');
  return {
    ...frequency,
    ...jest.requireActual('@/features/monetization/config'),
    ...jest.requireActual('@/features/monetization/interstitialExperiment'),
    GameBannerDock: () => null,
    getAds: () => ({ showInterstitial: mockShowInterstitial, prepareInterstitial: mockPrepareInterstitial }),
    loadAdsMeta: () => storage.getJSON(storage.KEYS.adsMeta) ?? frequency.EMPTY_ADS_META,
    saveAdsMeta: (meta: unknown) => storage.setJSONOrThrow(storage.KEYS.adsMeta, meta),
    useEntitlements: (selector: (value: { removeAds: boolean }) => unknown) => selector({ removeAds: false }),
  };
});
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


describe('adventure contextual monetization integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    AppState.currentState = 'active';
    tree = null;
    for (const key of [KEYS.adventureRun, KEYS.progression, KEYS.adsMeta, KEYS.adsPresentation, KEYS.analyticsExperiments]) removeKey(key);
    useAdPresentation.setState({ fullscreenActive: false, automaticAdsSuppressedUntil: 0 });
    setJSON(KEYS.adsMeta, {
      ...EMPTY_ADS_META, gamesPlayed: 12, adventureRunsPlayed: 12,
      adventureFailsSinceAd: 6, adventureLevelsSinceAd: 6,
    });
    mockShowInterstitial.mockImplementation(async (_placement, _telemetry, onImpression) => {
      onImpression?.();
      onImpression?.();
      return 'shown';
    });
    useProgression.setState({
      lifetimePoints: 0, level: 1, world: 1, unlockedThemes: ['classic'],
      activeTheme: 'classic', claimedRewards: [], appliedSettlements: [],
      rewardReceipts: {}, reveal: null, revealQueue: [],
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

  function resultProps() {
    const rendered = renderLevel();
    winLevel();
    act(() => { jest.advanceTimersByTime(3_000); });
    return rendered.root.findByProps({ testID: 'adventure-result' }).props;
  }

  it('retries a frequency-eligible failed run without requesting an interstitial', async () => {
    const rendered = renderLevel();
    act(() => {
      const run = useGameStore.getState().adventure!;
      useGameStore.setState({ adventure: { ...run, status: 'failed' } });
    });
    act(() => { jest.advanceTimersByTime(1_500); });
    const failure = rendered.root.findByProps({ testID: 'adventure-failure' });
    await act(async () => { failure.props.onRetry(); });
    expect(mockShowInterstitial).not.toHaveBeenCalled();
    expect(mockNewAdventureGame).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().adventure).toMatchObject({ status: 'playing', attempt: 1 });
  });

  it('declining a visible XP bonus allows an eligible ad on Next without adding a cooldown', async () => {
    const props = resultProps();
    expect(mockPrepareInterstitial).not.toHaveBeenCalled();
    act(() => { props.onPresentationReady(); });
    expect(mockPrepareInterstitial).toHaveBeenCalledTimes(1);
    act(() => { props.onBonusOfferAvailable(); });
    await act(async () => { props.onNext(); });
    expect(mockShowInterstitial).toHaveBeenCalledTimes(1);
    expect(mockNewAdventureGame).toHaveBeenCalledTimes(1);
    expect(useAdPresentation.getState().automaticAdsSuppressedUntil).toBe(0);
    expect(getJSON<AdsMeta>(KEYS.adsMeta)?.rewardedOfferContextId).toBeNull();
  });

  it('blocks stale Next and Exit during a bonus claim, then allows one transition when released', async () => {
    const props = resultProps();
    act(() => {
      props.onBonusOfferAvailable();
      expect(props.onBonusBusyChange(true)).toBe(true);
    });
    await act(async () => {
      props.onNext();
      props.onExit();
    });
    expect(mockShowInterstitial).not.toHaveBeenCalled();
    expect(mockNewAdventureGame).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => { props.onBonusBusyChange(false); });
    await act(async () => { props.onNext(); });
    expect(mockNewAdventureGame).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('synchronously rejects a stale bonus acquisition after Next has acquired the transition', async () => {
    const props = resultProps();
    let dismiss!: (value: string) => void;
    mockShowInterstitial.mockImplementation(() => new Promise((resolve) => { dismiss = resolve; }));
    await act(async () => {
      props.onNext();
      expect(props.onBonusBusyChange(true)).toBe(false);
      props.onExit();
    });
    expect(mockShowInterstitial).toHaveBeenCalledTimes(1);
    expect(mockNewAdventureGame).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => { dismiss('shown'); });
    expect(mockNewAdventureGame).toHaveBeenCalledTimes(1);
  });

  it('requests one eligible victory interstitial and persists one impression before starting the next run', async () => {
    const props = resultProps();
    await act(async () => { props.onNext(); props.onNext(); });
    expect(mockShowInterstitial).toHaveBeenCalledTimes(1);
    expect(mockShowInterstitial).toHaveBeenCalledWith(
      'adventure_level',
      expect.objectContaining({ policy_version: 'contextual-breaks-v3-decline-without-cooldown', result_context_id: props.completionId }),
      expect.any(Function),
    );
    const meta = getJSON<AdsMeta>(KEYS.adsMeta)!;
    expect(meta.adventureLevelsSinceAd).toBe(0);
    expect(meta.interstitialShowsInSession).toBe(1);
    expect(meta.lastInterstitialAt).toBe(Date.now());
    expect(mockNewAdventureGame).toHaveBeenCalledTimes(1);
  });
});
