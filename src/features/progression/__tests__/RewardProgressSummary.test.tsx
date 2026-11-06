import React from 'react';
import { act, create } from 'react-test-renderer';

import { useSettings } from '@/features/settings';

import { RewardProgressSummary } from '../components/RewardProgressSummary';
import { RewardVisual } from '../components/RewardVisual';
import { thresholdForLevel } from '../logic/levels';

describe('RewardProgressSummary', () => {
  let tree: ReturnType<typeof create>;

  beforeEach(() => {
    useSettings.setState({ lang: 'ru' });
  });

  afterEach(() => {
    if (tree) act(() => tree.unmount());
  });

  function render(earnedXp: number, lifetimePoints: number) {
    act(() => {
      tree = create(<RewardProgressSummary earnedXp={earnedXp} lifetimePoints={lifetimePoints} light />);
    });
  }

  function visibleText() {
    return tree.root.findAllByType('Text' as never).map((node) => node.children.join(''));
  }

  function trackValue() {
    return tree.root.findByProps({ testID: 'reward-progress-track' }).props.accessibilityValue;
  }

  it('keeps one XP amount visible and announces the full reward and level context', () => {
    render(500, 2_000);
    const summary = tree.root.findByProps({ testID: 'reward-progress-summary' });
    expect(summary.props.accessibilityRole).toBe('button');
    expect(summary.props.accessibilityLiveRegion).toBe('polite');
    expect(summary.props.accessibilityLabel).toContain('Получено 500 XP');
    expect(summary.props.accessibilityLabel).toContain('Общий уровень 2');
    expect(summary.props.accessibilityLabel).toContain('До уровня 3: 3500 XP');
    expect(summary.props.accessibilityLabel).toContain('помощник «Подсказка» · открыто');
    expect(summary.props.accessibilityState).toEqual({ expanded: false });

    expect(visibleText()).toContain('Капи +500 опыта');
    expect(visibleText().filter((value) => value.includes('+500'))).toEqual(['Капи +500 опыта']);
    expect(visibleText().join(' ')).toContain('помощник «Подсказка» · открыто');
  });

  it('shows the exact-threshold reward as unlocked with a full bar', () => {
    render(500, 2_000);
    expect(tree.root.findByType(RewardVisual).props.reward).toMatchObject({ kind: 'helper', id: 'hint' });
    expect(trackValue()).toEqual({ min: 0, max: 100, now: 100 });

    act(() => tree.root.findByProps({ testID: 'reward-progress-summary' }).props.onPress());
    expect(visibleText()).toContain('помощник «Подсказка» · открыто');
  });

  it('uses the upcoming reward threshold for the bar even across a level with no reward', () => {
    const previousRewardThreshold = thresholdForLevel(9);
    const nextRewardThreshold = thresholdForLevel(11);
    render(0, (previousRewardThreshold + nextRewardThreshold) / 2);

    expect(tree.root.findByType(RewardVisual).props.reward).toMatchObject({
      kind: 'cosmetic', id: 'face-sunglasses',
    });
    expect(visibleText()).toContain('Ранг 10 → 11');
    expect(trackValue()).toEqual({ min: 0, max: 100, now: 50 });
    expect(visibleText()).toContain('Капи +0 опыта');
    expect(visibleText()).not.toContain('+0 XP');
  });

  it('preserves a multi-level receipt amount and progress while toggling reward details', () => {
    render(9_000, 10_500);
    const summary = () => tree.root.findByProps({ testID: 'reward-progress-summary' });
    const reward = tree.root.findByType(RewardVisual).props.reward;
    const value = trackValue();

    expect(summary().props.accessibilityLabel).toContain('Получено 9000 XP. Общий уровень 4.');
    expect(reward).toMatchObject({ kind: 'world', world: 2 });
    expect(visibleText()).toContain('Капи +9000 опыта');
    expect(visibleText()).toContain('дизайн мира 2 · открыто');

    act(() => summary().props.onPress());
    expect(summary().props.accessibilityState).toEqual({ expanded: true });
    expect(visibleText()).toContain('дизайн мира 2 · открыто');
    expect(visibleText()).toContain('Капи +9000 опыта');
    expect(trackValue()).toEqual(value);
    expect(tree.root.findByType(RewardVisual).props.reward).toEqual(reward);

    act(() => summary().props.onPress());
    expect(summary().props.accessibilityState).toEqual({ expanded: false });
    expect(visibleText()).toContain('дизайн мира 2 · открыто');
    expect(trackValue()).toEqual(value);
  });

  it('shows a completed rail without promising a reward beyond the authored catalog', () => {
    render(100, thresholdForLevel(64) + 1);
    const summary = tree.root.findByProps({ testID: 'reward-progress-summary' });

    expect(summary.props.accessibilityLabel).toContain('Все награды открыты');
    expect(tree.root.findAllByType(RewardVisual)).toHaveLength(0);
    expect(trackValue()).toEqual({ min: 0, max: 100, now: 100 });
    act(() => summary.props.onPress());
    expect(visibleText()).toContain('Все награды открыты');
  });
});
