import React from 'react';
import { act, create } from 'react-test-renderer';
import { KEYS, removeKey } from '@/core/storage';

import { GameOverOverlay } from '../components/GameOverOverlay';

type MockGameStoreState = {
  game: { status: 'playing' | 'over'; score: number; reviveUsed: boolean };
  lastEvent: { gameOver?: boolean } | null;
  finalResult: { newRecord: boolean } | null;
  continueGame: jest.Mock<boolean, []>;
  epoch: number;
  runBestAtStart: number;
  classicMeta: { runId: string; lifecycle: 'terminal_revivable' | 'terminal_final' } | null;
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
const mockRecordInterstitialShown = jest.fn(
  (meta: MockAdsMeta, nowMs: number) => ({
    ...meta,
    gameOversSinceAd: 0,
    lastFullscreenAt: nowMs,
    lastInterstitialAt: nowMs,
  }),
);
const mockRecordFullscreenCooldown = jest.fn(
  (meta: MockAdsMeta, nowMs: number) => ({
    ...meta,
    lastFullscreenAt: nowMs,
  }),
);
const mockSaveAdsMeta = jest.fn((meta: MockAdsMeta) => {
  currentAdsMeta = meta;
});
const mockLoadAdsMeta = jest.fn(() => currentAdsMeta);
const mockShouldShowInterstitial = jest.fn((_meta: MockAdsMeta, _opts: unknown) => false);
let mockReadyListener: (() => void) | undefined;
const mockPrepareRewarded = jest.fn(async () => {});

const mockAdsProvider = {
  init: jest.fn(() => Promise.resolve()),
  showInterstitial: jest.fn(
    (
      _placement: string,
      _telemetry?: unknown,
      onImpression?: () => void,
    ) => {
      onImpression?.();
      return Promise.resolve<'shown' | 'skipped' | 'unavailable'>('shown');
    },
  ),
  showRewarded: jest.fn(() => Promise.resolve<'rewarded' | 'dismissed' | 'unavailable'>('rewarded')),
  isRewardedReady: jest.fn(() => true),
  prepareRewarded: mockPrepareRewarded,
  subscribeRewardedReady: jest.fn((listener: () => void) => {
    mockReadyListener = listener;
    return () => { mockReadyListener = undefined; };
  }),
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
    getState: () => ({ track: mockTrack, trackOnce: (_key: string, name: string, props: unknown) => mockTrack(name, props) }),
  },
}));

jest.mock('@/features/monetization', () => ({
  MONETIZATION: { adsEnabled: true },
  evaluateInterstitialOpportunity: (meta: MockAdsMeta, opts: unknown, _counter: string, _mode: string,
    context?: { rewardedOfferPresented?: boolean }) => {
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
    radii: { button: 16 },
    spacing: { s: 8, m: 16, l: 24, xl: 32 },
  };
});

jest.mock('../store', () => ({
  useGameStore: (selector: (state: MockGameStoreState) => unknown) => selector(mockGameStoreState),
}));

jest.mock('../effects/Confetti', () => ({
  Confetti: () => null,
}));

jest.mock('../components/ReviveButton', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return {
    ReviveButton: ({
      label,
      disabled,
      onPress,
    }: {
      label: string;
      disabled?: boolean;
      onPress: () => void;
    }) =>
      ReactLocal.createElement('revive-button', {
        testID: 'revive-button',
        label,
        disabled,
        onPress,
      }),
  };
});

function makeGameState(overrides: Partial<MockGameStoreState> = {}): MockGameStoreState {
  return {
    game: { status: 'over', score: 321, reviveUsed: false },
    lastEvent: { gameOver: true },
    finalResult: null,
    continueGame: jest.fn(() => true),
    epoch: 7,
    runBestAtStart: 100,
    classicMeta: { runId: 'run-1', lifecycle: 'terminal_revivable' },
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
    mockAdsProvider.isRewardedReady.mockReturnValue(true);
    mockReadyListener = undefined;
    removeKey(KEYS.adsMeta);
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

  it('reveals the advertised continuation when a later rewarded load becomes ready', async () => {
    mockAdsProvider.isRewardedReady.mockReturnValue(false);
    const renderer = mount();
    await flushMicrotasks();
    act(() => { jest.advanceTimersByTime(1_000); });
    expect(renderer.root.findAllByProps({ testID: 'revive-button' })).toHaveLength(0);
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    act(() => {
      mockAdsProvider.isRewardedReady.mockReturnValue(true);
      mockReadyListener?.();
    });
    expect(renderer.root.findByProps({ testID: 'revive-button' })).toBeDefined();
    expect(mockTrack.mock.calls.filter(([name]) => name === 'revive_shown')).toHaveLength(1);
  });

  it('does not prepare an unused replacement while a successful continuation closes the result', async () => {
    let dismiss!: (result: 'rewarded') => void;
    mockAdsProvider.showRewarded.mockImplementationOnce(() => new Promise(resolve => { dismiss = resolve; }));
    mockGameStoreState.continueGame.mockImplementationOnce(() => {
      mockGameStoreState.game.status = 'playing';
      return true;
    });
    const renderer = mount();
    await flushMicrotasks();
    act(() => { jest.advanceTimersByTime(1_000); });
    act(() => { renderer.root.findByProps({ testID: 'revive-button' }).props.onPress(); });
    expect(mockReadyListener).toBeUndefined();
    await act(async () => {
      mockAdsProvider.isRewardedReady.mockReturnValue(false);
      dismiss('rewarded');
    });
    expect(mockGameStoreState.continueGame).toHaveBeenCalledTimes(1);
    expect(mockPrepareRewarded).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ testID: 'revive-button' })).toHaveLength(0);
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
    mockGameStoreState.classicMeta = { runId: 'final-run', lifecycle: 'terminal_final' };
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(345_678);
    mockShouldShowInterstitial.mockReturnValueOnce(true);
    mockAdsProvider.showInterstitial.mockImplementationOnce(
      (
        _placement: string,
        _telemetry?: unknown,
        onImpression?: () => void,
      ) => {
        onImpression?.();
        return new Promise<'shown'>(() => {});
      },
    );
    const renderer = mount();
    await flushMicrotasks();
    act(() => { jest.advanceTimersByTime(1_000); });
    const replay = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'gameOver.playAgain',
    );

    act(() => { replay.props.onPress(); });
    await flushMicrotasks();

    expect(mockRecordInterstitialShown).toHaveBeenCalledTimes(1);
    expect(currentAdsMeta.lastInterstitialAt).toBe(345_678);
    expect(onPlayAgain).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('writes fullscreen cooldown after a rewarded revive without faking an interstitial show', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123_456);
    const renderer = mount();

    await flushMicrotasks();
    act(() => {
      jest.advanceTimersByTime(800);
    });

    const reviveButton = renderer.root.findByProps({ testID: 'revive-button' });
    await act(async () => {
      await reviveButton.props.onPress();
    });

    expect(mockGameStoreState.continueGame).toHaveBeenCalledTimes(1);
    expect(mockRecordFullscreenCooldown).toHaveBeenCalledTimes(1);
    expect(mockRecordFullscreenCooldown).toHaveBeenCalledWith(
      expect.objectContaining({ gameOversSinceAd: 1 }),
      123_456,
    );
    expect(mockRecordInterstitialShown).not.toHaveBeenCalled();
    expect(currentAdsMeta.lastFullscreenAt).toBe(123_456);
    expect(currentAdsMeta.lastInterstitialAt).toBeNull();

    nowSpy.mockRestore();
  });

  it('writes fullscreen cooldown after a dismissed rewarded revive without continuing the run', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(222_333);
    mockAdsProvider.showRewarded.mockResolvedValueOnce('dismissed');
    const renderer = mount();

    await flushMicrotasks();
    act(() => {
      jest.advanceTimersByTime(800);
    });

    const reviveButton = renderer.root.findByProps({ testID: 'revive-button' });
    await act(async () => {
      await reviveButton.props.onPress();
    });

    expect(mockGameStoreState.continueGame).not.toHaveBeenCalled();
    expect(mockRecordFullscreenCooldown).toHaveBeenCalledTimes(1);
    expect(currentAdsMeta.lastFullscreenAt).toBe(222_333);
    expect(currentAdsMeta.lastInterstitialAt).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('revive_used', { result: 'dismissed' });

    nowSpy.mockRestore();
  });

  it('does not write fullscreen cooldown when rewarded revive is unavailable', async () => {
    mockAdsProvider.showRewarded.mockResolvedValueOnce('unavailable');
    const renderer = mount();

    await flushMicrotasks();
    act(() => {
      jest.advanceTimersByTime(800);
    });

    const reviveButton = renderer.root.findByProps({ testID: 'revive-button' });
    await act(async () => {
      await reviveButton.props.onPress();
    });

    expect(mockGameStoreState.continueGame).not.toHaveBeenCalled();
    expect(mockRecordFullscreenCooldown).not.toHaveBeenCalled();
    expect(currentAdsMeta.lastFullscreenAt).toBeNull();
    expect(currentAdsMeta.lastInterstitialAt).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('revive_used', { result: 'unavailable' });
  });

  it('falls back to the rewarded outcome when the ad pays out but continueGame rejects', async () => {
    mockGameStoreState = makeGameState({
      continueGame: jest.fn(() => false),
    });
    const renderer = mount();

    await flushMicrotasks();
    act(() => {
      jest.advanceTimersByTime(800);
    });

    const reviveButton = renderer.root.findByProps({ testID: 'revive-button' });
    await act(async () => {
      await reviveButton.props.onPress();
    });

    expect(mockGameStoreState.continueGame).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('revive_used', { result: 'rewarded' });
  });

  it('treats ordinary replay as a decline of a visible revive and never chains an interstitial', async () => {
    mockShouldShowInterstitial.mockReturnValueOnce(true);
    const renderer = mount();
    await flushMicrotasks();
    act(() => { jest.advanceTimersByTime(1_000); });
    expect(renderer.root.findByProps({ testID: 'revive-button' })).toBeDefined();
    const replay = renderer.root.find(node => node.props.accessibilityLabel === 'gameOver.playAgain');
    await act(async () => { await replay.props.onPress(); });
    expect(mockAdsProvider.showInterstitial).not.toHaveBeenCalled();
    expect(mockAdsProvider.showRewarded).not.toHaveBeenCalled();
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it('allows only one transition from two rapid presses of the same result', async () => {
    mockGameStoreState.classicMeta = { runId: 'final-run', lifecycle: 'terminal_final' };
    const renderer = mount();
    await flushMicrotasks();
    act(() => { jest.advanceTimersByTime(1_000); });
    const replay = renderer.root.find(node => node.props.accessibilityLabel === 'gameOver.playAgain');
    await act(async () => {
      replay.props.onPress();
      replay.props.onPress();
    });
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });
});
