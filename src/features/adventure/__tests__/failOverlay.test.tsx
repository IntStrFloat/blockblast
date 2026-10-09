import React from 'react';
import { act, create } from 'react-test-renderer';

import { FailOverlay } from '../components/FailOverlay';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@/features/settings', () => ({ useLang: () => 'ru' }));
jest.mock('@/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactModule = require('react');
  return {
    AppText: 'AppText',
    StarIcon: 'StarIcon',
    GameButton: (props: object) => ReactModule.createElement('GameButton', props),
    radii: { card: 24, button: 16 },
    spacing: { s: 8, m: 16, l: 24, xl: 32 },
  };
});

describe('FailOverlay presentation', () => {
  let renderer: ReturnType<typeof create>;

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
  });

  function render(props: Partial<React.ComponentProps<typeof FailOverlay>> = {}) {
    act(() => {
      renderer = create(
        <FailOverlay
          objective="jewels"
          current={4}
          target={7}
          remaining={3}
          tip="collect_jewel_line"
          helpEligible
          onRetry={jest.fn()}
          onRetryWithHelp={jest.fn()}
          onExit={jest.fn()}
          {...props}
        />,
      );
    });
  }

  function copy() {
    return renderer.root.findAllByType('AppText' as never).map((node) => node.children.join(''));
  }

  function buttons() {
    return renderer.root.findAllByType('GameButton' as never);
  }

  it('shows one visual counter and keeps the full factual result accessible', () => {
    render();
    expect(copy()).toContain('4/7');
    expect(copy()).not.toContain('Собрано 4/7, осталось 3');
    expect(copy().join(' ')).not.toContain('Правила и цель не изменятся');
    expect(renderer.root.findByProps({ accessibilityLabel: 'Собрано 4/7, осталось 3' }).props.accessible).toBe(true);
    expect(buttons().map((node) => node.props.label)).toEqual([
      'С подсказкой · бесплатно',
      'Попробовать ещё',
      'Выйти',
    ]);
  });

  it('reveals and hides the relevant tip only when its accessible button is pressed', () => {
    render();
    const tipText = 'Совет: сначала собирай линии, в которых уже лежат кристаллы.';
    const tipButton = () => renderer.root.findByProps({ accessibilityRole: 'button' });
    expect(copy()).not.toContain(tipText);
    expect(tipButton().props.accessibilityRole).toBe('button');
    expect(tipButton().props.accessibilityState).toEqual({ expanded: false });

    act(() => tipButton().props.onPress());
    expect(copy()).toContain(tipText);
    expect(tipButton().props.accessibilityState).toEqual({ expanded: true });

    act(() => tipButton().props.onPress());
    expect(copy()).not.toContain(tipText);
    expect(tipButton().props.accessibilityState).toEqual({ expanded: false });
  });

  it('routes help, retry and exit to their own callbacks exactly once', () => {
    const onRetry = jest.fn();
    const onRetryWithHelp = jest.fn();
    const onExit = jest.fn();
    render({ onRetry, onRetryWithHelp, onExit });
    const [help, retry, exit] = buttons();

    act(() => help.props.onPress());
    expect(onRetryWithHelp).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
    act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
    act(() => exit.props.onPress());
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onRetryWithHelp).toHaveBeenCalledTimes(1);
  });

  it('keeps every game action disabled while a transition is busy', () => {
    render({ disabled: true });
    expect(buttons()).toHaveLength(3);
    expect(buttons().every((node) => node.props.disabled === true)).toBe(true);
  });

  it('keeps ordinary retry available without the help offer', () => {
    render({
      objective: 'score', current: 81, target: 128, remaining: 47, tip: 'open_space',
      helpEligible: false, onRetryWithHelp: undefined,
    });

    expect(copy()).toContain('81/128');
    expect(renderer.root.findAllByType('StarIcon' as never)).toHaveLength(1);
    expect(buttons().map((node) => node.props.label)).toEqual([
      'Попробовать ещё',
      'Выйти',
    ]);
    expect(buttons()[0].props.disabled).toBe(false);
    expect(buttons()[0].props.variant).toBe('primary');
  });

  it('does not render a help action without its handler even when eligible', () => {
    render({ helpEligible: true, onRetryWithHelp: undefined });
    expect(buttons().map((node) => node.props.label)).toEqual(['Попробовать ещё', 'Выйти']);
  });
});
