import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { AdsProvider } from '../types';
import { useRewardedReady } from '../useRewardedReady';

const mockLoad = jest.fn();
const mockInitialize = jest.fn();
let mockProvider: AdsProvider;
let mockFullscreen = false;
const mockAppListeners = new Set<(state: string) => void>();
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  default: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppListeners.add(listener);
      return { remove: () => mockAppListeners.delete(listener) };
    },
  },
}));
jest.mock('yandex-mobile-ads', () => ({
  MobileAds: { initialize: () => mockInitialize() },
  RewardedAdLoader: { create: async () => ({ loadAd: mockLoad }) },
  InterstitialAdLoader: { create: jest.fn() },
}));
jest.mock('@/core/storage', () => ({
  KEYS: { adsMeta: 'ads.meta', adsPresentation: 'ads.presentation.v1' },
  getJSON: () => null,
  setJSON: jest.fn(),
}));
jest.mock('@/features/analytics', () => ({
  getExperimentAssignment: () => undefined,
  useAnalyticsStore: { getState: () => ({ track: jest.fn() }) },
}));
jest.mock('../adPresentation', () => ({
  useAdPresentation: {
    getState: () => ({ fullscreenActive: mockFullscreen }),
    setState: ({ fullscreenActive }: { fullscreenActive: boolean }) => { mockFullscreen = fullscreenActive; },
  },
  areAutomaticAdsSuppressed: () => false,
  suppressAutomaticAds: jest.fn(),
}));
jest.mock('../index', () => ({ getAds: () => mockProvider }));

let observedReady: boolean[];
function Offer({ index = 0 }: { index?: number }) {
  observedReady[index] = useRewardedReady();
  return null;
}

describe('visible offer recovery with the native Yandex provider', () => {
  let tree: ReactTestRenderer | undefined;
  let warning: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFullscreen = false;
    observedReady = [];
    mockLoad.mockReset();
    mockInitialize.mockReset().mockResolvedValue(undefined);
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mockProvider = require('../yandexAds.native').YandexAdsProvider;
    });
  });
  afterEach(async () => {
    await act(async () => { tree?.unmount(); });
    tree = undefined;
    expect(mockAppListeners.size).toBe(0);
    warning.mockRestore();
    jest.useRealTimers();
  });

  it('recovers a swallowed SDK load failure while the same offer stays mounted', async () => {
    mockLoad.mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValue({ show: jest.fn(async () => {}) });
    await act(async () => { tree = create(<Offer />); });
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(observedReady[0]).toBe(false);
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(observedReady[0]).toBe(true);
    await act(async () => { jest.advanceTimersByTime(600_000); });
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  it('recovers a swallowed initialization failure before loading inventory', async () => {
    mockInitialize.mockRejectedValueOnce(new Error('initialization unavailable'));
    mockLoad.mockResolvedValue({ show: jest.fn(async () => {}) });
    await act(async () => { tree = create(<Offer />); });
    expect(mockLoad).not.toHaveBeenCalled();
    expect(observedReady[0]).toBe(false);
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(mockInitialize).toHaveBeenCalledTimes(2);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(observedReady[0]).toBe(true);
  });

  it('bounds offline requests, pauses in background and recovers on foreground', async () => {
    mockLoad.mockRejectedValue(new Error('offline'));
    await act(async () => { tree = create(<Offer />); });
    await act(async () => { jest.advanceTimersByTime(30_000); });
    await act(async () => { jest.advanceTimersByTime(60_000); });
    await act(async () => { jest.advanceTimersByTime(600_000); });
    expect(mockLoad).toHaveBeenCalledTimes(3);
    await act(async () => { mockAppListeners.forEach((listener) => listener('background')); });
    mockLoad.mockResolvedValue({ show: jest.fn(async () => {}) });
    await act(async () => { jest.advanceTimersByTime(600_000); });
    expect(mockLoad).toHaveBeenCalledTimes(3);
    await act(async () => { mockAppListeners.forEach((listener) => listener('active')); });
    expect(mockLoad).toHaveBeenCalledTimes(4);
    expect(observedReady[0]).toBe(true);
  });

  it('shares concurrent initial and retry loads across visible offers', async () => {
    mockLoad.mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ show: jest.fn(async () => {}) });
    await act(async () => { tree = create(<><Offer /><Offer index={1} /></>); });
    expect(mockLoad).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(observedReady).toEqual([true, true]);
  });

  it('refills only after the real fullscreen lifecycle finishes', async () => {
    const ad = { show: jest.fn(async () => {}), onAdDismissed: undefined as (() => void) | undefined };
    mockLoad.mockResolvedValue(ad);
    await act(async () => { tree = create(<Offer />); });
    let showing!: ReturnType<AdsProvider['showRewarded']>;
    await act(async () => { showing = mockProvider.showRewarded('revive'); });
    expect(observedReady[0]).toBe(false);
    await act(async () => { jest.advanceTimersByTime(600_000); });
    expect(mockLoad).toHaveBeenCalledTimes(1);
    await act(async () => { ad.onAdDismissed?.(); await showing; });
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(observedReady[0]).toBe(true);
  });
});
