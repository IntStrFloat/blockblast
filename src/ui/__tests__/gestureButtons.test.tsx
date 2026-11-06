import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { PauseOverlay } from '@/features/game/components/PauseOverlay';
import { GameButton } from '../primitives/GameButton';
import { IconButton } from '../primitives/IconButton';

const mockSpring = jest.fn((value: number) => value);

jest.mock('react-native-gesture-handler', () => ({ Pressable: 'GesturePressable' }));
jest.mock('react-native-reanimated', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  return {
    __esModule: true,
    default: { createAnimatedComponent: (Component: unknown) => Component, View: 'AnimatedView' },
    ...jest.requireActual('react-native-reanimated/mock'),
    FadeIn: { duration: () => ({}) },
    Easing: { out: (x: unknown) => x, quad: () => {} },
    withTiming: (...args: Parameters<typeof mockSpring>) => mockSpring(...args),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    useAnimatedStyle: (read: () => object) => read(),
    withSpring: (...args: Parameters<typeof mockSpring>) => mockSpring(...args),
  };
});
jest.mock('../AppText', () => ({ AppText: 'AppText' }));
jest.mock('@/ui', () => ({
  ...jest.requireActual('@/ui/theme'),
  ...jest.requireActual('@/ui/nightCandy'),
  CandyCapy: () => null, CandyIcon: () => null,
  GameButton: jest.requireActual('../primitives/GameButton').GameButton,
  Overlay: ({ children }: { children: React.ReactNode }) => children,
  AppText: 'AppText',
}));
jest.mock('@/features/settings', () => ({
  useLang: () => 'ru',
  useSettings: (select: (state: object) => unknown) => select({ sound: true, haptics: true, update: jest.fn() }),
}));

describe('gesture-backed shared controls', () => {
  let tree: ReactTestRenderer | undefined;
  afterEach(() => {
    if (tree) act(() => tree!.unmount());
    tree = undefined;
    mockSpring.mockClear();
  });
  const buttons = () => tree!.root.findAllByType('GesturePressable' as React.ElementType);

  it('keeps the primary action on the native gesture pressable while its scale changes', () => {
    const onPress = jest.fn();
    act(() => { tree = create(<GameButton label="Next" onPress={onPress} />); });
    expect(buttons()).toHaveLength(1);
    const button = buttons()[0];
    expect(button.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Next', disabled: false });
    act(() => { button.props.onPressIn(); button.props.onPressOut(); button.props.onPress(); });
    expect(mockSpring.mock.calls.map(([value]) => value)).toEqual([1, 0]);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('forwards disabled state to the gesture recognizer and accessibility', () => {
    act(() => { tree = create(<GameButton label="Next" onPress={jest.fn()} disabled />); });
    expect(buttons()[0].props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  });

  it('preserves an icon action and its expanded touch target', () => {
    const onPress = jest.fn();
    act(() => { tree = create(<IconButton onPress={onPress} accessibilityLabel="Back">icon</IconButton>); });
    expect(buttons()[0].props).toMatchObject({ hitSlop: 8, accessibilityLabel: 'Back', accessibilityRole: 'button' });
    act(() => buttons()[0].props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('requires a second press before restarting from pause', () => {
    const actions = { onClose: jest.fn(), onHome: jest.fn(), onRestart: jest.fn() };
    act(() => { tree = create(<PauseOverlay {...actions} />); });
    const restart = () => buttons().find((node) => node.props.accessibilityLabel === 'Заново')!;
    act(() => restart().props.onPress());
    expect(actions.onRestart).not.toHaveBeenCalled();
    const confirm = buttons().find((node) => node.props.accessibilityLabel === 'Да, заново')!;
    act(() => confirm.props.onPress());
    expect(actions.onRestart).toHaveBeenCalledTimes(1);
  });
});
