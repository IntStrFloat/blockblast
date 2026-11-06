import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useGameStore } from '../store';
import { useScores } from '@/features/scores';
import { useSettings } from '@/features/settings';
import { Hud } from '../components/Hud';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('score HUD bindings', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => {
    useSettings.setState({ lang: 'ru' });
    useScores.setState({ best: 10400 });
    useGameStore.setState((s) => ({ game: { ...s.game, score: 999 }, runBestAtStart: 10400 }));
  });
  afterEach(() => { if (tree) act(() => tree.unmount()); });

  it('retains the score node when authoritative score crosses a digit boundary', () => {
    act(() => { tree = create(React.createElement(Hud, { onPause: jest.fn() })); });
    const score = tree.root.findAllByProps({ testID: 'hud-score-text' }).find((node) => typeof node.type === 'string')!;
    expect(score.props.children).toBe('999');
    act(() => useGameStore.setState((s) => ({ game: { ...s.game, score: 1000 } })));
    expect(tree.root.findAllByProps({ testID: 'hud-score-text' }).find((node) => typeof node.type === 'string')).toBe(score);
    expect(score.props.children).toBe('1 000');
    expect(score.props.numberOfLines).toBe(1);
  });

  it('keeps the full number and pause available for long saved scores', () => {
    useGameStore.setState((s) => ({ game: { ...s.game, score: 123456789 } }));
    const pause = jest.fn();
    act(() => { tree = create(React.createElement(Hud, { onPause: pause })); });
    const score = tree.root.findAllByProps({ testID: 'hud-score-text' }).find((node) => typeof node.type === 'string')!;
    expect(score.props.children).toBe('123 456 789');
    const button = tree.root.findAllByProps({ accessibilityLabel: 'Пауза' }).find((node) => typeof node.props.onPress === 'function')!;
    act(() => button.props.onPress());
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
