import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { storage } from '@/core/storage';
import { useProgression } from '@/features/progression';
import { GameButton } from '@/ui';

import { AdventureXpBonus } from '../components/AdventureXpBonus';

const mockAds = {
  init: jest.fn(async () => {}),
  isRewardedReady: jest.fn(() => true),
  showRewarded: jest.fn<Promise<'rewarded' | 'dismissed' | 'unavailable'>, [string, (() => void)?]>(),
};
jest.mock('@/features/monetization', () => ({ getAds: () => mockAds }));

describe('Adventure bonus result action', () => {
  beforeEach(() => {
    storage.clearAll();
    jest.clearAllMocks();
    mockAds.isRewardedReady.mockReturnValue(true);
    mockAds.showRewarded.mockResolvedValue('unavailable');
    useProgression.setState({ lifetimePoints: 0, level: 1, world: 1, unlockedThemes: ['classic'], activeTheme: 'classic', claimedRewards: [], appliedSettlements: [], rewardReceipts: {}, reveal: null, revealQueue: [] });
    useProgression.getState().grantReward({ runId: 'ui-run', completionId: 'ui-level', rewardId: 'xp', source: 'adventure', targetAmount: 500 });
  });

  async function render(props: Partial<React.ComponentProps<typeof AdventureXpBonus>> = {}) {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<AdventureXpBonus runId="ui-run" completionId="ui-level" {...props} />); });
    return tree;
  }

  it('hides unavailable ads and announces only a ready, exact amount offer', async () => {
    mockAds.isRewardedReady.mockReturnValue(false);
    const unavailable = jest.fn();
    const tree = await render({ onOfferAvailable: unavailable });
    expect(tree.root.findAllByType(GameButton)).toHaveLength(0);
    expect(unavailable).not.toHaveBeenCalled();
    act(() => tree.unmount());
    mockAds.isRewardedReady.mockReturnValue(true);
    const available = jest.fn();
    const readyTree = await render({ onOfferAvailable: available });
    expect(readyTree.root.findByType(GameButton).props.label).toContain('+500 XP');
    expect(readyTree.root.findByType(GameButton).props.label).toContain('рекламу');
    expect(available).toHaveBeenCalledTimes(1);
    act(() => readyTree.unmount());
  });

  it('blocks repeated taps and keeps parent navigation busy until dismissal', async () => {
    let earn!: () => void;
    let dismiss!: (result: 'rewarded') => void;
    mockAds.showRewarded.mockImplementation((_placement, onEarned) => {
      earn = onEarned!;
      return new Promise((resolve) => { dismiss = resolve; });
    });
    const busy = jest.fn();
    const tree = await render({ onBusyChange: busy });
    const press = tree.root.findByType(GameButton).props.onPress;
    act(() => { press(); press(); });
    expect(mockAds.showRewarded).toHaveBeenCalledTimes(1);
    expect(busy).toHaveBeenLastCalledWith(true);
    act(() => earn());
    expect(useProgression.getState().lifetimePoints).toBe(1_000);
    expect(busy).toHaveBeenLastCalledWith(true);
    await act(async () => { dismiss('rewarded'); });
    expect(busy).toHaveBeenLastCalledWith(false);
    expect(tree.root.findAllByType(GameButton)).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('releases navigation after dismissal with no bonus', async () => {
    mockAds.showRewarded.mockResolvedValue('dismissed');
    const busy = jest.fn();
    const tree = await render({ onBusyChange: busy });
    await act(async () => tree.root.findByType(GameButton).props.onPress());
    expect(busy.mock.calls).toEqual([[true], [false]]);
    expect(useProgression.getState().lifetimePoints).toBe(500);
    act(() => tree.unmount());
  });

  it('does not launch an ad when the screen rejects stale result ownership', async () => {
    const acquire = jest.fn(() => false);
    const tree = await render({ onBusyChange: acquire });
    await act(async () => tree.root.findByType(GameButton).props.onPress());
    expect(acquire).toHaveBeenCalledWith(true);
    expect(mockAds.showRewarded).not.toHaveBeenCalled();
    expect(tree.root.findByType(GameButton).props.disabled).toBe(false);
    act(() => tree.unmount());
  });

  it('ignores a captured old button handler after the result unmounts', async () => {
    const acquire = jest.fn();
    const tree = await render({ onBusyChange: acquire });
    const press = tree.root.findByType(GameButton).props.onPress;
    act(() => tree.unmount());
    await act(async () => press());
    expect(acquire).not.toHaveBeenCalled();
    expect(mockAds.showRewarded).not.toHaveBeenCalled();
  });

  it('queues the earned level-up now and presents it only after the ad closes', async () => {
    useProgression.getState().grantReward({ runId: 'ui-run', completionId: 'ui-level', rewardId: 'xp', source: 'adventure', targetAmount: 3_000 });
    let earn!: () => void;
    let dismiss!: (result: 'rewarded') => void;
    mockAds.showRewarded.mockImplementation((_placement, onEarned) => {
      earn = onEarned!;
      return new Promise((resolve) => { dismiss = resolve; });
    });
    const tree = await render();
    act(() => tree.root.findByType(GameButton).props.onPress());
    act(() => earn());
    expect(useProgression.getState().lifetimePoints).toBe(6_000);
    expect(useProgression.getState().reveal).toBeNull();
    expect(useProgression.getState().revealQueue[0]?.runId).toBe('ui-run');
    await act(async () => dismiss('rewarded'));
    expect(useProgression.getState().reveal?.runId).toBe('ui-run');
    act(() => tree.unmount());
  });

  it('releases an acquired parent lock after dismissal even if the result was unmounted', async () => {
    let dismiss!: (result: 'dismissed') => void;
    mockAds.showRewarded.mockImplementation(() => new Promise((resolve) => { dismiss = resolve; }));
    const busy = jest.fn();
    const tree = await render({ onBusyChange: busy });
    act(() => tree.root.findByType(GameButton).props.onPress());
    act(() => tree.unmount());
    await act(async () => dismiss('dismissed'));
    expect(busy.mock.calls).toEqual([[true], [false]]);
  });
});
