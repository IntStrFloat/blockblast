import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AdBanner } from '../AdBanner.native';
import { useAdPresentation } from '../adPresentation';
import { useEntitlements } from '../entitlements';

const mockTrack = jest.fn();
const mockMount = jest.fn();
const mockUnmount = jest.fn();
jest.mock('@/features/analytics', () => ({ useAnalyticsStore: { getState: () => ({ track: mockTrack }) } }));
jest.mock('yandex-mobile-ads', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    BannerAdSize: { stickySize: jest.fn(async () => ({ width: 320, height: 50 })) },
    BannerView: function MockBanner(props: Record<string, unknown>) {
      React.useEffect(() => { mockMount(); return mockUnmount; }, []);
      return React.createElement('mock-banner', props);
    },
  };
});

describe('native banner bounded recovery', () => {
  let tree: ReactTestRenderer;
  let changeState: (state: AppStateStatus) => void;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    AppState.currentState = 'active';
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      changeState = callback;
      return { remove: jest.fn() };
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    useEntitlements.setState({ removeAds: false });
    useAdPresentation.setState({ fullscreenActive: false, automaticAdsSuppressedUntil: 0 });
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  async function mount() {
    await act(async () => { tree = create(<AdBanner ftueComplete gamesPlayed={2} />); });
  }
  function fail() {
    act(() => tree.root.findByType('mock-banner' as never).props.onAdFailedToLoad({
      nativeEvent: { error: { code: 3, description: 'Network error' } },
    }));
  }
  async function advance(ms: number) {
    await act(async () => { jest.advanceTimersByTime(ms); });
  }
  function appState(state: AppStateStatus) {
    act(() => { AppState.currentState = state; changeState(state); });
  }

  it('remounts at 30 and 60 seconds, retains banner height, then stops', async () => {
    await mount();
    fail();
    expect(mockTrack).toHaveBeenCalledWith('ad_failed', expect.objectContaining({ message: '3: Network error' }));
    await advance(29_999);
    expect(mockMount).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(mockMount).toHaveBeenCalledTimes(2);
    expect(tree.root.findByType('mock-banner' as never).props.size.height).toBe(50);
    fail();
    await advance(59_999);
    expect(mockMount).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(mockMount).toHaveBeenCalledTimes(3);
    fail();
    await advance(600_000);
    expect(mockMount).toHaveBeenCalledTimes(3);
    expect(mockUnmount).toHaveBeenCalledTimes(2);
  });

  it('cancels pending retry when the SDK loads successfully itself', async () => {
    await mount();
    fail();
    await advance(10_000);
    act(() => tree.root.findByType('mock-banner' as never).props.onAdLoaded());
    await advance(600_000);
    expect(mockMount).toHaveBeenCalledTimes(1);
  });

  it('leaves loaded banner refresh failures to the SDK, including foreground return', async () => {
    await mount();
    act(() => tree.root.findByType('mock-banner' as never).props.onAdLoaded());
    fail();
    await advance(600_000);
    expect(mockMount).toHaveBeenCalledTimes(1);
    appState('background');
    await advance(60_000);
    appState('active');
    await advance(600_000);
    fail();
    await advance(600_000);
    expect(mockMount).toHaveBeenCalledTimes(1);
    expect(mockUnmount).not.toHaveBeenCalled();
    expect(mockTrack.mock.calls.filter(([event]) => event === 'ad_requested')).toHaveLength(1);
  });

  it('still recovers an initial failure after a loaded placement is removed and restored', async () => {
    await mount();
    act(() => tree.root.findByType('mock-banner' as never).props.onAdLoaded());
    act(() => useAdPresentation.setState({ fullscreenActive: true }));
    await act(async () => useAdPresentation.setState({ fullscreenActive: false }));
    expect(mockMount).toHaveBeenCalledTimes(2);
    fail();
    await advance(30_000);
    expect(mockMount).toHaveBeenCalledTimes(3);
  });

  it('starts a fresh bounded recovery on a genuine foreground return after exhaustion', async () => {
    await mount();
    fail();
    await advance(30_000);
    fail();
    await advance(60_000);
    fail();
    appState('active');
    await advance(600_000);
    expect(mockMount).toHaveBeenCalledTimes(3);
    appState('background');
    appState('active');
    appState('active');
    await advance(1);
    expect(mockMount).toHaveBeenCalledTimes(4);
    act(() => tree.root.findByType('mock-banner' as never).props.onAdLoaded());
    await advance(600_000);
    expect(mockMount).toHaveBeenCalledTimes(4);
  });

  it('preserves a loaded native banner and its attempt id when returning to foreground', async () => {
    await mount();
    act(() => tree.root.findByType('mock-banner' as never).props.onAdLoaded());
    const attemptId = mockTrack.mock.calls.find(([event]) => event === 'ad_requested')![1].attempt_id;
    appState('background');
    await advance(60_000);
    await act(async () => appState('active'));
    await advance(600_000);
    expect(mockMount).toHaveBeenCalledTimes(1);
    expect(mockTrack.mock.calls.filter(([event]) => event === 'ad_requested')).toHaveLength(1);
    act(() => tree.root.findByType('mock-banner' as never).props.onAdClicked());
    expect(mockTrack).toHaveBeenCalledWith('ad_clicked', expect.objectContaining({ attempt_id: attemptId }));
  });

  it('pauses retries in background and rate limits foreground recovery', async () => {
    await mount();
    fail();
    await advance(5_000);
    appState('background');
    await advance(5_000);
    appState('active');
    await advance(19_999);
    expect(mockMount).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(mockMount).toHaveBeenCalledTimes(2);
    fail();
    appState('background');
    await advance(600_000);
    expect(mockMount).toHaveBeenCalledTimes(2);
    appState('active');
    await advance(1);
    expect(mockMount).toHaveBeenCalledTimes(3);
  });

  it.each(['entitlement', 'fullscreen', 'suppressed', 'offscreen'])('cancels recovery when %s', async (reason) => {
    await mount();
    fail();
    act(() => {
      if (reason === 'entitlement') useEntitlements.setState({ removeAds: true });
      if (reason === 'fullscreen') useAdPresentation.setState({ fullscreenActive: true });
      if (reason === 'suppressed') useAdPresentation.setState({ automaticAdsSuppressedUntil: Date.now() + 900_000 });
      if (reason === 'offscreen') tree.unmount();
    });
    await advance(600_000);
    expect(mockMount).toHaveBeenCalledTimes(1);
  });

  it('does not start an initial request while backgrounded', async () => {
    AppState.currentState = 'background';
    await mount();
    await advance(600_000);
    expect(mockMount).not.toHaveBeenCalled();
    await act(async () => appState('active'));
    expect(mockMount).toHaveBeenCalledTimes(1);
  });

  it('defers remount when suppression expires in the background', async () => {
    await mount();
    act(() => useAdPresentation.setState({ automaticAdsSuppressedUntil: Date.now() + 30_000 }));
    appState('background');
    await advance(60_000);
    expect(mockMount).toHaveBeenCalledTimes(1);
    await act(async () => appState('active'));
    expect(mockMount).toHaveBeenCalledTimes(2);
    expect(mockTrack.mock.calls.filter(([event]) => event === 'ad_requested')).toHaveLength(2);
  });
});
