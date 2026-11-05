import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useRewardedReady } from '../useRewardedReady';

let mockReady = false;
let mockFullscreen = false;
let mockAppState = 'active';
let mockAppListener: ((state: string) => void) | undefined;
const mockRemoveAppListener = jest.fn();
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  default: {
    get currentState() { return mockAppState; },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppListener = listener;
      return { remove: mockRemoveAppListener };
    },
  },
}));
jest.mock('../adPresentation', () => ({
  useAdPresentation: { getState: () => ({ fullscreenActive: mockFullscreen }) },
}));
let mockListener: (() => void) | undefined;
const mockUnsubscribe = jest.fn();
const mockPrepareRewarded = jest.fn(async () => {});
const mockInit = jest.fn(async () => {});
const mockAds = {
  init: mockInit,
  isRewardedReady: () => mockReady,
  prepareRewarded: mockPrepareRewarded,
  subscribeRewardedReady: jest.fn((listener: () => void) => {
    mockListener = listener;
    return mockUnsubscribe;
  }),
};
jest.mock('../index', () => ({ getAds: () => mockAds }));

let observedReady = false;
function Offer({ active = true }: { active?: boolean }) {
  const ready = useRewardedReady(active);
  useEffect(() => { observedReady = ready; }, [ready]);
  return null;
}

describe('visible rewarded inventory', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockReady = false;
    mockFullscreen = false;
    mockAppState = 'active';
    mockAppListener = undefined;
    mockListener = undefined;
    mockPrepareRewarded.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => { jest.useRealTimers(); });

  it('prepares only active offers and unsubscribes when hidden', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<Offer active={false} />); });
    expect(mockPrepareRewarded).not.toHaveBeenCalled();
    expect(observedReady).toBe(false);
    await act(async () => { tree.update(<Offer />); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    expect(mockInit).not.toHaveBeenCalled();
    await act(async () => { tree.update(<Offer active={false} />); });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    await act(async () => { tree.unmount(); });
  });

  it('updates readiness after later loading and prepares a replacement after dismissal', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<Offer />); });
    expect(observedReady).toBe(false);
    await act(async () => { mockReady = true; mockListener?.(); });
    expect(observedReady).toBe(true);
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    await act(async () => { mockReady = false; mockListener?.(); });
    expect(observedReady).toBe(false);
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    await act(async () => { mockListener?.(); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    await act(async () => { mockReady = true; mockListener?.(); });
    expect(observedReady).toBe(true);
    await act(async () => { tree.unmount(); });
  });

  it('recovers a failed preparation after 30 seconds and stops after two retries', async () => {
    mockPrepareRewarded.mockRejectedValue(new Error('network unavailable'));
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<Offer />); });
    await act(async () => { jest.advanceTimersByTime(29_999); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(59_999); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(3);
    await act(async () => { jest.advanceTimersByTime(600_000); mockListener?.(); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(3);
    await act(async () => { tree.unmount(); });
  });

  it('cancels retries when hidden or unmounted', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<Offer />); });
    await act(async () => { tree.update(<Offer active={false} />); });
    await act(async () => { jest.advanceTimersByTime(600_000); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    await act(async () => { tree.update(<Offer />); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    await act(async () => { tree.unmount(); });
    await act(async () => { jest.advanceTimersByTime(600_000); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    expect(mockRemoveAppListener).toHaveBeenCalledTimes(2);
  });

  it('pauses background requests and resumes on foreground without rapid retry loops', async () => {
    let tree!: ReactTestRenderer;
    mockAppState = 'background';
    await act(async () => { tree = create(<Offer />); });
    expect(mockPrepareRewarded).not.toHaveBeenCalled();
    await act(async () => { mockAppListener?.('active'); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    await act(async () => { mockAppListener?.('background'); });
    await act(async () => { jest.advanceTimersByTime(600_000); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    await act(async () => { mockAppListener?.('active'); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    for (let index = 0; index < 5; index += 1) {
      await act(async () => { mockAppListener?.('background'); mockAppListener?.('active'); });
    }
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(3);
    await act(async () => { tree.unmount(); });
  });

  it('does not overlap a pending request or refill during a fullscreen ad', async () => {
    let complete!: () => void;
    mockPrepareRewarded.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<Offer />); });
    await act(async () => { mockAppListener?.('background'); mockAppListener?.('active'); mockListener?.(); });
    await act(async () => { jest.advanceTimersByTime(600_000); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    await act(async () => { mockReady = true; complete(); mockListener?.(); });
    await act(async () => { mockReady = false; mockFullscreen = true; mockListener?.(); });
    await act(async () => { jest.advanceTimersByTime(600_000); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    await act(async () => { mockFullscreen = false; mockListener?.(); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    await act(async () => { tree.unmount(); });
  });

  it('keeps recovery scheduled when returning to an unresolved request', async () => {
    let complete!: () => void;
    mockPrepareRewarded.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<Offer />); });
    await act(async () => { mockAppListener?.('background'); mockAppListener?.('active'); });
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    await act(async () => { complete(); });
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(2);
    await act(async () => { tree.unmount(); });
  });

  it('handles failed preparation without a request loop or late updates', async () => {
    mockPrepareRewarded.mockRejectedValueOnce(new Error('no fill'));
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<Offer />); });
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(1);
    expect(observedReady).toBe(false);
    await act(async () => { tree.unmount(); });
    await act(async () => { mockReady = true; mockListener?.(); });
    expect(observedReady).toBe(false);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
