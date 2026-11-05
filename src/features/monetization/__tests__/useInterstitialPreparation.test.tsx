import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useInterstitialPreparation } from '../useInterstitialPreparation';
import { useAdPresentation } from '../adPresentation';
let mockState = 'active';
let mockListener: ((state: string) => void) | undefined;
jest.mock('react-native/Libraries/AppState/AppState', () => ({ default: {
  get currentState() { return mockState; },
  addEventListener: (_name: string, listener: (state: string) => void) => {
    mockListener = listener; return { remove: () => { mockListener = undefined; } };
  },
} }));
const mockPrepare = jest.fn(async () => {});
const mockEvaluate = jest.fn((..._args: unknown[]) => ({ shouldRequest: true }));
let mockLastFullscreen: number | null = null;
jest.mock('../index', () => ({
  MONETIZATION: { adsEnabled: true, interstitial: { minIntervalSec: 180 } },
  getAds: () => ({ prepareInterstitial: mockPrepare }),
  loadAdsMeta: () => ({ lastFullscreenAt: mockLastFullscreen, lastInterstitialAt: null }),
  evaluateInterstitialOpportunity: (...args: unknown[]) => mockEvaluate(...args),
}));
function Result({ active = true, id = 'result-a' }) {
  useInterstitialPreparation({ active, counter: 'gameover', mode: 'classic', removeAds: false,
    resultContextId: id, activePlayMs: 120_000 });
  return null;
}
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(1_000_000); jest.clearAllMocks();
  mockState = 'active'; mockLastFullscreen = null; mockEvaluate.mockReturnValue({ shouldRequest: true });
  useAdPresentation.setState({ fullscreenActive: false, automaticAdsSuppressedUntil: 0 });
});
afterEach(() => { if (tree) act(() => tree.unmount()); jest.useRealTimers(); });
it('preloads at an eligible result before the user presses a continuation, without logging exposure', async () => {
  await act(async () => { tree = create(<Result active={false} />); });
  expect(mockPrepare).not.toHaveBeenCalled();
  await act(async () => { tree.update(<Result />); });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  expect(mockEvaluate).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 'gameover', 'classic',
    { activePlayMs: 120_000, resultContextId: 'result-a' }, { recordExposure: false });
  await act(async () => { tree.update(<Result />); });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  await act(async () => { tree.update(<Result id="result-b" />); });
  expect(mockPrepare).toHaveBeenCalledTimes(2);
});
it('does not preload results excluded by frequency or experiment', async () => {
  mockEvaluate.mockReturnValue({ shouldRequest: false });
  await act(async () => { tree = create(<Result />); });
  expect(mockPrepare).not.toHaveBeenCalled();
});
it('waits for a real fullscreen cooldown and cancels the timer when leaving', async () => {
  mockLastFullscreen = Date.now();
  await act(async () => { tree = create(<Result />); });
  expect(mockPrepare).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(180_001); });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  act(() => { useAdPresentation.setState({ automaticAdsSuppressedUntil: Date.now() + 180_000 }); });
  await act(async () => { tree.update(<Result active={false} />); });
  await act(async () => { jest.advanceTimersByTime(180_001); });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
});
it('does not start background requests and prepares when returning to a visible result', async () => {
  mockState = 'background';
  await act(async () => { tree = create(<Result />); });
  expect(mockPrepare).not.toHaveBeenCalled();
  await act(async () => { mockState = 'active'; mockListener?.('active'); });
  expect(mockPrepare).toHaveBeenCalledTimes(1);
});
it('does not preload during a fullscreen surface', async () => {
  useAdPresentation.setState({ fullscreenActive: true });
  await act(async () => { tree = create(<Result />); });
  expect(mockPrepare).not.toHaveBeenCalled();
});
