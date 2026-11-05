import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { LevelUpReveal } from '../components/LevelUpReveal';

let mockReveal: { level: number; rewards: { kind: string; id: string }[] } | null;
const mockClear = jest.fn(() => { mockReveal = null; });
const mockFeedback = jest.fn();
jest.mock('@/features/progression', () => ({
  useProgression: (select: (state: object) => unknown) => select({ reveal: mockReveal, clearReveal: mockClear }),
}));
jest.mock('@/features/progression/components/RewardVisual', () => ({ RewardVisual: 'RewardVisual' }));
jest.mock('@/features/progression/logic/presentation', () => ({ rewardDisplayName: (reward: { id: string }) => reward.id }));
jest.mock('../hooks/useMascotFeedback', () => ({ useMascotFeedback: () => ({ onLevelUp: mockFeedback }) }));
jest.mock('@/features/settings', () => ({ useLang: () => 'ru' }));
jest.mock('@/ui', () => ({ AppText: 'AppText', CheckIcon: 'CheckIcon', StarIcon: 'StarIcon' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
jest.mock('react-native-gesture-handler', () => ({ Pressable: 'GesturePressable' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => ({}) },
}));

describe('board-owned level-up notifications', () => {
  let tree: ReactTestRenderer | undefined;
  beforeEach(() => {
    jest.useFakeTimers();
    mockClear.mockClear(); mockFeedback.mockClear();
    mockReveal = { level: 12, rewards: Array.from({ length: 7 }, (_, index) => ({ kind: 'cosmetic', id: `reward-${index}` })) };
  });
  afterEach(() => {
    if (tree) act(() => tree!.unmount());
    tree = undefined;
    jest.useRealTimers();
  });

  it('preserves a hidden reward until the notification is visible for its display window', () => {
    act(() => { tree = create(<LevelUpReveal hidden top={12} width={160} />); });
    expect(tree!.toJSON()).toBeNull();
    act(() => jest.advanceTimersByTime(10_000));
    expect(mockClear).not.toHaveBeenCalled();
    expect(mockFeedback).not.toHaveBeenCalled();
    act(() => tree!.update(<LevelUpReveal top={12} width={160} />));
    expect(mockFeedback).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1299));
    expect(mockClear).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('cancels its visible timeout while hidden and starts a display window on return', () => {
    act(() => { tree = create(<LevelUpReveal />); });
    act(() => jest.advanceTimersByTime(700));
    act(() => tree!.update(<LevelUpReveal hidden />));
    act(() => jest.advanceTimersByTime(10_000));
    expect(mockClear).not.toHaveBeenCalled();
    expect(tree!.toJSON()).toBeNull();
    act(() => tree!.update(<LevelUpReveal />));
    act(() => jest.advanceTimersByTime(1299));
    expect(mockClear).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('uses the supplied board anchor and bounds a wrapping reward row to that width', () => {
    act(() => { tree = create(<LevelUpReveal top={10} width={160} />); });
    const host = tree!.root.findByProps({ testID: 'level-up-reveal' });
    expect(StyleSheet.flatten(host.props.style)).toMatchObject({ top: 10, width: 160, left: undefined, right: undefined, alignSelf: 'center' });
    const button = tree!.root.findByType('GesturePressable' as React.ElementType);
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ maxWidth: '100%', flexWrap: 'wrap' });
    expect(tree!.root.findAllByType('RewardVisual' as React.ElementType)).toHaveLength(3);
    expect(button.props.accessibilityLabel).toContain('reward-6');
    act(() => button.props.onPress());
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('keeps the same timeout through board reflow', () => {
    act(() => { tree = create(<LevelUpReveal top={12} width={160} />); });
    act(() => jest.advanceTimersByTime(700));
    act(() => tree!.update(<LevelUpReveal top={18} width={184} />));
    act(() => jest.advanceTimersByTime(600));
    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockFeedback).toHaveBeenCalledTimes(1);
    act(() => tree!.unmount());
    tree = undefined;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels a still-pending reveal timeout when the notification unmounts', () => {
    act(() => { tree = create(<LevelUpReveal top={10} width={160} />); });
    act(() => jest.advanceTimersByTime(700));
    act(() => tree!.unmount());
    tree = undefined;
    expect(jest.getTimerCount()).toBe(0);
    act(() => jest.advanceTimersByTime(10_000));
    expect(mockClear).not.toHaveBeenCalled();
  });
});
