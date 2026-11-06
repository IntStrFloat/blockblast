import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { FailOverlay } from '../components/FailOverlay';
import { GameButton } from '@/ui';

jest.mock('@/features/settings', () => ({ useLang: () => 'ru' }));

describe('Adventure final failure', () => {
  let tree: ReactTestRenderer;
  afterEach(() => { if (tree) act(() => tree.unmount()); });
  it('keeps factual goal context and separate Retry/Home actions', () => {
    const retry = jest.fn(), home = jest.fn();
    act(() => { tree = create(<FailOverlay objective="jewels" current={4} target={7} remaining={3} tip="collect_jewel_line" onRetry={retry} onExit={home} />); });
    expect(tree.root.findByProps({ accessibilityLabel: 'Собрано 4/7, осталось 3' }).props.accessible).toBe(true);
    const actions = tree.root.findAllByType(GameButton);
    expect(actions.map((node) => node.props.label)).toEqual(['Попробовать ещё', 'Домой']);
    act(() => actions[0].props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
    expect(home).not.toHaveBeenCalled();
    act(() => actions[1].props.onPress());
    expect(home).toHaveBeenCalledTimes(1);
  });
  it('disables both actions while a transition owns the result', () => {
    act(() => { tree = create(<FailOverlay objective="score" current={81} target={128} remaining={47} tip="open_space" onRetry={jest.fn()} onExit={jest.fn()} disabled />); });
    expect(tree.root.findAllByType(GameButton).every((node) => node.props.disabled)).toBe(true);
  });
});
