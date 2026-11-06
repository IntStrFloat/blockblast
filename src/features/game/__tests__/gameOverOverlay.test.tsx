import React from 'react';
import { AppState } from 'react-native';
import { act, create } from 'react-test-renderer';
import { KEYS, removeKey } from '@/core/storage';

import { GameOverOverlay } from '../components/GameOverOverlay';

type MockGameStoreState = {
  game: { status: 'playing' | 'over'; score: number; reviveUsed: boolean };
  lastEvent: { gameOver?: boolean } | null;
  finalResult: { newRecord: boolean } | null;
  continueGame: jest.Mock<boolean, []>;
  finishCurrentResult: jest.Mock;
  epoch: number;
  runBestAtStart: number;
  classicMeta: {
    runId: string;
    lifecycle: 'terminal_revivable' | 'terminal_final';
    resultAcknowledged?: boolean;
  } | null;
};

type MockAdsMeta = {
  gamesPlayed: number;
  adventureRunsPlayed: number;
  adventureLevelsCompleted: number;
  gameOversSinceAd: number;
  adventureFailsSinceAd: number;
  adventureLevelsSinceAd: number;
  lastFullscreenAt: number | null;
  lastInterstitialAt: number | null;
};

let mockGameStoreState: MockGameStoreState;
let mockScoresState: { best: number; gamesPlayed: number };
let currentAdsMeta: MockAdsMeta;

const mockTrack = jest.fn();
const mockRecordGameOverForPush = jest.fn();
const mockRecordGameOver = jest.fn((meta: MockAdsMeta) => ({
  ...meta,
  gameOversSinceAd: meta.gameOversSinceAd + 1,
}));
const mockRecordInterstitialShown = jest.fn((meta: MockAdsMeta, nowMs: number) => ({
  ...meta,
  gameOversSinceAd: 0,
  lastFullscreenAt: nowMs,
  lastInterstitialAt: nowMs,
}));
const mockRecordFullscreenCooldown = jest.fn((meta: MockAdsMeta, nowMs: number) => ({
  ...meta,
  lastFullscreenAt: nowMs,
}));
const mockSaveAdsMeta = jest.fn((meta: MockAdsMeta) => {
  currentAdsMeta = meta;
});
const mockLoadAdsMeta = jest.fn(() => currentAdsMeta);
const mockShouldShowInterstitial = jest.fn((_meta: MockAdsMeta, _opts: unknown) => false);
const mockPrepareRewarded = jest.fn(async () => {});
const mockPrepareInterstitial = jest.fn(async () => {});

const mockAdsProvider = {
  init: jest.fn(() => Promise.resolve()),
  showInterstitial: jest.fn(
    (_placement: string, _telemetry?: unknown, onImpression?: () => void) => {
      onImpression?.();
      return Promise.resolve<'shown' | 'skipped' | 'unavailable'>('shown');
    },
  ),
  showRewarded: jest.fn((_placement: string, onEarned?: () => void) => {
    onEarned?.();
    return Promise.resolve<'rewarded' | 'dismissed' | 'unavailable'>('rewarded');
  }),
  isRewardedReady: jest.fn(() => true),
  prepareRewarded: mockPrepareRewarded,
  prepareInterstitial: mockPrepareInterstitial,
  subscribeRewardedReady: jest.fn(() => () => {}),
};

jest.mock('expo-linear-gradient', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return {
    LinearGradient: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactLocal.createElement('linear-gradient', props, children),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 24, left: 0 }),
}));

jest.mock('@/core/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/features/analytics', () => ({
  useAnalyticsStore: {
    getState: () => ({
      track: mockTrack,
      trackOnce: (_key: string, name: string, props: unknown) => mockTrack(name, props),
    }),
  },
}));

jest.mock('@/features/monetization', () => ({
  MONETIZATION: jest.requireActual('@/features/monetization/config').MONETIZATION,
  evaluateInterstitialOpportunity: (
    meta: MockAdsMeta,
    opts: unknown,
    _counter: string,
    _mode: string,
    context?: { rewardedOfferPresented?: boolean },
  ) => {
    const eligible = mockShouldShowInterstitial(meta, opts);
    return {
      variant: 'control',
      baseEligible: eligible,
      shouldRequest: eligible && !context?.rewardedOfferPresented,
      decision: eligible ? 'request' : 'frequency_policy',
      telemetry: null,
    };
  },
  getAds: () => mockAdsProvider,
  getRewardedCtaPolicy: ({
    offerAllowed,
    rewardedReady,
    busy,
  }: {
    offerAllowed: boolean;
    rewardedReady: boolean;
    busy: boolean;
  }) => {
    const visible = offerAllowed && rewardedReady;
    return { visible, disabled: visible && busy };
  },
  loadAdsMeta: () => mockLoadAdsMeta(),
  recordFullscreenCooldown: (meta: MockAdsMeta, nowMs: number) =>
    mockRecordFullscreenCooldown(meta, nowMs),
  recordGameOver: (meta: MockAdsMeta) => mockRecordGameOver(meta),
  recordInterstitialShown: (meta: MockAdsMeta, nowMs: number) =>
    mockRecordInterstitialShown(meta, nowMs),
  saveAdsMeta: (meta: MockAdsMeta) => mockSaveAdsMeta(meta),
  useEntitlements: (selector: (state: { removeAds: boolean }) => boolean) =>
    selector({ removeAds: false }),
}));

jest.mock('@/features/notifications', () => ({
  recordGameOverForPush: () => mockRecordGameOverForPush(),
  recordFirstRecordForPush: jest.fn(),
}));

jest.mock('@/features/scores', () => ({
  useScores: Object.assign(
    (selector: (state: { best: number; gamesPlayed: number }) => unknown) =>
      selector(mockScoresState),
    {
      getState: () => mockScoresState,
    },
  ),
}));

jest.mock('@/features/settings', () => ({
  useLang: () => 'en',
}));

jest.mock('@/ui', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return {
    AppText: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactLocal.createElement('app-text', props, children),
    CrownIcon: (props: Record<string, unknown>) => ReactLocal.createElement('crown-icon', props),
    GearIcon: (props: Record<string, unknown>) => ReactLocal.createElement('gear-icon', props),
    ...jest.requireActual('@/ui/nightCandy'),
    CandyBackground: () => null,
    CandyIcon: (props: Record<string, unknown>) => ReactLocal.createElement('candy-icon', props),
    GameButton: jest.requireActual('@/ui/primitives/GameButton').GameButton,
    radii: { button: 16 },
    spacing: { s: 8, m: 16, l: 24, xl: 32 },
  };
});

jest.mock('../store', () => ({
  reconcileRevivedLeaderboardProof: () => true,
  useGameStore: Object.assign(
    (selector: (state: MockGameStoreState) => unknown) => selector(mockGameStoreState),
    { getState: () => mockGameStoreState },
  ),
}));

jest.mock('../effects/Confetti', () => ({
  Confetti: () => null,
}));

jest.mock('../components/NoMovesSheet', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return { NoMovesSheet: (props: object) => ReactLocal.createElement('no-moves-sheet', props) };
});

let runSequence = 0;
function makeGameState(overrides: Partial<MockGameStoreState> = {}): MockGameStoreState {
  return {
    game: { status: 'over', score: 321, reviveUsed: false },
    lastEvent: { gameOver: true },
    finalResult: null,
    continueGame: jest.fn(() => true),
    finishCurrentResult: jest.fn(),
    epoch: 7,
    runBestAtStart: 100,
    classicMeta: {
      runId: `run-${++runSequence}`,
      lifecycle: 'terminal_revivable',
      resultAcknowledged: true,
    },
    ...overrides,
  };
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('GameOverOverlay', () => {
  const renderers: ReturnType<typeof create>[] = [];
  const onPlayAgain = jest.fn();
  const onOpenSettings = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    AppState.currentState = 'active';
    mockShouldShowInterstitial.mockReset().mockReturnValue(false);
    mockAdsProvider.isRewardedReady.mockReturnValue(true);
    removeKey(KEYS.adsMeta);
    removeKey(KEYS.rewardedBenefits);
    mockGameStoreState = makeGameState();
    mockScoresState = { best: 250, gamesPlayed: 12 };
    currentAdsMeta = {
      gamesPlayed: 0,
      adventureRunsPlayed: 0,
      adventureLevelsCompleted: 0,
      gameOversSinceAd: 0,
      adventureFailsSinceAd: 0,
      adventureLevelsSinceAd: 0,
      lastFullscreenAt: null,
      lastInterstitialAt: null,
    };
  });

  afterEach(() => {
    act(() => {
      while (renderers.length > 0) {
        renderers.pop()!.unmount();
      }
    });
    jest.useRealTimers();
  });

  function mount() {
    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(
        <GameOverOverlay onPlayAgain={onPlayAgain} onOpenSettings={onOpenSettings} />,
      );
    });
    renderers.push(renderer!);
    return renderer!;
  }

  it('keeps replay and record prompts behind an explicit end decision', async () => {
    mockGameStoreState.classicMeta!.resultAcknowledged = false;
    const renderer = mount();
    await flushMicrotasks();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const recordPrompt = jest.requireMock('@/features/notifications').recordFirstRecordForPush;
    expect(recordPrompt).not.toHaveBeenCalled();
    const sheet = renderer.root.findByType('no-moves-sheet' as never);
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'gameOver.playAgain'),
    ).toHaveLength(0);
    act(() => {
      sheet.props.onFinish();
    });
    expect(mockGameStoreState.finishCurrentResult).toHaveBeenCalledTimes(1);
    mockGameStoreState.classicMeta!.resultAcknowledged = true;
    act(() => {
      renderer.update(
        <GameOverOverlay onPlayAgain={onPlayAgain} onOpenSettings={onOpenSettings} />,
      );
    });
    expect(renderer.root.findAllByType('no-moves-sheet' as never)).toHaveLength(0);
    expect(recordPrompt).toHaveBeenCalledTimes(1);
    expect(
      renderer.root.find((node) => node.props.accessibilityLabel === 'gameOver.playAgain'),
    ).toBeDefined();
  });

  it('counts the first fresh death only once within the same epoch even after a rewarded revive', async () => {
    const renderer = mount();
    await flushMicrotasks();

    expect(mockRecordGameOver).toHaveBeenCalledTimes(1);
    expect(mockRecordGameOverForPush).toHaveBeenCalledTimes(1);

    mockGameStoreState = makeGameState({
      game: { status: 'playing', score: 321, reviveUsed: true },
      lastEvent: null,
      epoch: 7,
    });
    act(() => {
      renderer.update(
        <GameOverOverlay onPlayAgain={onPlayAgain} onOpenSettings={onOpenSettings} />,
      );
    });

    mockGameStoreState = makeGameState({
      game: { status: 'over', score: 377, reviveUsed: true },
      lastEvent: { gameOver: true },
      epoch: 7,
    });
    act(() => {
      renderer.update(
        <GameOverOverlay onPlayAgain={onPlayAgain} onOpenSettings={onOpenSettings} />,
      );
    });
    await flushMicrotasks();

    expect(mockRecordGameOver).toHaveBeenCalledTimes(1);
    expect(mockRecordGameOverForPush).toHaveBeenCalledTimes(1);
  });

  it('counts again when a genuinely new epoch reaches game over', async () => {
    const renderer = mount();
    await flushMicrotasks();
    expect(mockRecordGameOver).toHaveBeenCalledTimes(1);

    mockGameStoreState = makeGameState({
      game: { status: 'playing', score: 20, reviveUsed: false },
      lastEvent: null,
      epoch: 8,
    });
    act(() => {
      renderer.update(
        <GameOverOverlay onPlayAgain={onPlayAgain} onOpenSettings={onOpenSettings} />,
      );
    });

    mockGameStoreState = makeGameState({
      game: { status: 'over', score: 88, reviveUsed: false },
      lastEvent: { gameOver: true },
      epoch: 8,
    });
    act(() => {
      renderer.update(
        <GameOverOverlay onPlayAgain={onPlayAgain} onOpenSettings={onOpenSettings} />,
      );
    });
    await flushMicrotasks();

    expect(mockRecordGameOver).toHaveBeenCalledTimes(2);
    expect(mockRecordGameOverForPush).toHaveBeenCalledTimes(2);
  });

  it('does not count a cold terminal reopen without a fresh game-over event', async () => {
    mockGameStoreState = makeGameState({
      game: { status: 'over', score: 654, reviveUsed: true },
      lastEvent: null,
      epoch: 11,
      classicMeta: { runId: 'run-cold', lifecycle: 'terminal_final' },
    });

    mount();
    await flushMicrotasks();

    expect(mockRecordGameOver).not.toHaveBeenCalled();
    expect(mockRecordGameOverForPush).not.toHaveBeenCalled();
  });

  it('persists frequency at impression before dismiss/process interruption', async () => {
    mockGameStoreState.classicMeta = {
      runId: 'final-run',
      lifecycle: 'terminal_final',
      resultAcknowledged: true,
    };
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(345_678);
    mockShouldShowInterstitial.mockReturnValue(true);
    mockAdsProvider.showInterstitial.mockImplementationOnce(
      (_placement: string, _telemetry?: unknown, onImpression?: () => void) => {
        onImpression?.();
        return new Promise<'shown'>(() => {});
      },
    );
    const renderer = mount();
    await flushMicrotasks();
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    const replay = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'gameOver.playAgain',
    );

    act(() => {
      replay.props.onPress();
    });
    await flushMicrotasks();

    expect(mockRecordInterstitialShown).toHaveBeenCalledTimes(1);
    expect(currentAdsMeta.lastInterstitialAt).toBe(345_678);
    expect(onPlayAgain).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('allows only one transition from two rapid presses of the same result', async () => {
    mockGameStoreState.classicMeta = {
      runId: 'final-run',
      lifecycle: 'terminal_final',
      resultAcknowledged: true,
    };
    const renderer = mount();
    await flushMicrotasks();
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    const replay = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'gameOver.playAgain',
    );
    await act(async () => {
      replay.props.onPress();
      replay.props.onPress();
    });
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });
});
