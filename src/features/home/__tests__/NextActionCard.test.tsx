import React from 'react';
import { StyleSheet, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import { AppText, CheckIcon } from '@/ui';

import { NextActionCard } from '../components/NextActionCard';

describe('NextActionCard', () => {
  it('keeps the goal explanation accessible without a visible paragraph and preserves its action', () => {
    const onPress = jest.fn();
    const detail = 'Уровень 2. Осталось 1500 XP до подсказки.';
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <NextActionCard
          kind="reward"
          title="Подсказка"
          detail={detail}
          icon={<View testID="reward-visual" />}
          current={500}
          target={2000}
          onPress={onPress}
        />,
      );
    });

    const button = tree.root.findByProps({ testID: 'next-action-reward' });
    expect(button.props.accessibilityLabel).toBe(`Подсказка. ${detail}`);
    expect(tree.root.findAllByType(AppText).map((node) => node.props.children))
      .toEqual(['Подсказка', '500/2000']);
    expect(tree.root.findByProps({ testID: 'reward-visual' })).toBeTruthy();
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([
    [500, 2000, '25%'],
    [2200, 2000, '100%'],
    [-10, 2000, '0%'],
    [0, 0, '0%'],
  ])('keeps the visual fill within its track for %i/%i', (current, target, width) => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <NextActionCard
          kind="weekly"
          title="Цель недели"
          detail={`${current}/${target}`}
          icon={null}
          current={current}
          target={target}
          onPress={() => {}}
        />,
      );
    });

    const fill = tree.root.findByProps({ testID: 'next-action-progress' });
    expect(StyleSheet.flatten(fill.props.style).width).toBe(width);
  });

  it('marks an available reward visually without showing an artificial 1/1 counter', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <NextActionCard
          kind="reward"
          title="Кепка"
          accessibilityLabel="Кепка"
          detail="Доступно сейчас · открыть и надеть"
          icon={null}
          current={1}
          target={1}
          complete
          onPress={() => {}}
        />,
      );
    });

    expect(tree.root.findByType(CheckIcon)).toBeTruthy();
    expect(tree.root.findAllByType(AppText).map((node) => node.props.children)).toEqual(['Кепка']);
    expect(tree.root.findByProps({ testID: 'next-action-reward' }).props.accessibilityLabel)
      .toContain('Кепка. Доступно сейчас');
  });
});
