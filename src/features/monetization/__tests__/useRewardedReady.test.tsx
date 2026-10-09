import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useRewardedReady } from '../useRewardedReady';

let mockReady = false;
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
    jest.clearAllMocks();
    mockReady = false;
    mockListener = undefined;
    mockPrepareRewarded.mockReset().mockResolvedValue(undefined);
  });

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
    expect(mockPrepareRewarded).toHaveBeenCalledTimes(3);
    await act(async () => { mockReady = true; mockListener?.(); });
    expect(observedReady).toBe(true);
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
