import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { LevelResultTransition } from '../components/LevelResultTransition';

let mockReducedMotion = false;
const mockAnimations: { finish?: (finished: boolean) => void; duration: number }[] = [];
const mockCancel = jest.fn();
jest.mock('@/features/game/animation/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('react-native-reanimated', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  return {
    __esModule: true,
    default: { View: 'AnimatedView' },
    Easing: { bezier: () => 'ease-out' },
    cancelAnimation: (...args: unknown[]) => mockCancel(...args),
    useSharedValue: (value: number) => ReactModule.useRef({ value, get() { return this.value; }, set(next: number) { this.value = next; } }).current,
    useAnimatedStyle: (updater: () => object) => updater(),
    withTiming: (value: number, config: { duration: number }, finish?: (finished: boolean) => void) => {
      mockAnimations.push({ finish, duration: config.duration });
      return value;
    },
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (callback: () => void) => callback() }));

describe('Adventure result entrance', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => { mockAnimations.length = 0; mockReducedMotion = false; mockCancel.mockClear(); });
  afterEach(() => { if (tree) act(() => tree.unmount()); });

  it('starts after native layout and announces readiness only after the animation finishes', () => {
    const ready = jest.fn();
    act(() => { tree = create(<LevelResultTransition onReady={ready}>result</LevelResultTransition>); });
    expect(mockAnimations).toHaveLength(0);
    const host = tree.root.findByProps({ testID: 'adventure-result-transition' });
    expect(host.props.collapsable).toBe(false);
    expect(host.props.style[1].opacity).toBe(0);
    act(() => { host.props.onLayout(); host.props.onLayout(); });
    expect(mockAnimations).toHaveLength(1);
    expect(mockAnimations[0].duration).toBeLessThanOrEqual(300);
    expect(ready).not.toHaveBeenCalled();
    act(() => { mockAnimations[0].finish?.(true); });
    expect(ready).toHaveBeenCalledTimes(1);
    act(() => { host.props.onLayout(); });
    expect(mockAnimations).toHaveLength(1);
  });

  it('uses a short fade without scale or translation for reduced motion', () => {
    mockReducedMotion = true;
    act(() => { tree = create(<LevelResultTransition>result</LevelResultTransition>); });
    const host = tree.root.findByProps({ testID: 'adventure-result-transition' });
    expect(host.props.style[1].transform).toEqual([{ translateY: 0 }, { scale: 1 }]);
    act(() => { host.props.onLayout(); });
    expect(mockAnimations[0].duration).toBeLessThanOrEqual(160);
  });

  it('cancels on unmount and ignores interrupted or stale completion callbacks', () => {
    const ready = jest.fn();
    act(() => { tree = create(<LevelResultTransition onReady={ready}>result</LevelResultTransition>); });
    act(() => { tree.root.findByProps({ testID: 'adventure-result-transition' }).props.onLayout(); });
    act(() => { mockAnimations[0].finish?.(false); });
    expect(ready).not.toHaveBeenCalled();
    act(() => { tree.unmount(); });
    expect(mockCancel).toHaveBeenCalled();
    act(() => { mockAnimations[0].finish?.(true); });
    expect(ready).not.toHaveBeenCalled();
  });
});
