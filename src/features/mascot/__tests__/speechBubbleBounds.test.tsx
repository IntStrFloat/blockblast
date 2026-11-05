import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import { SpeechBubble } from '../components/SpeechBubble';

jest.mock('@/ui', () => ({
  ...jest.requireActual('@/ui/theme'),
  AppText: jest.requireActual('@/ui/AppText').AppText,
}));
jest.mock('react-native-reanimated', () => {
  const transition = {
    springify() { return this; }, damping() { return this; }, stiffness() { return this; },
    reduceMotion() { return this; }, duration() { return this; },
  };
  return { __esModule: true, default: { View: 'AnimatedView' }, ZoomIn: transition, FadeOut: transition, ReduceMotion: { System: 'system' } };
});

it('bounds the 220 dp bubble to its parent and limits visual text without shortening its accessible content', () => {
  const message = 'Привет! Давай соберём ещё несколько линий и освободим место для новых фигур. '.repeat(3);
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<View style={{ width: 160 }}><SpeechBubble text={message} /></View>); });
  const surface = tree.root.findAllByType(View).find((node) => StyleSheet.flatten(node.props.style)?.width === 220)!;
  expect(surface).toBeDefined();
  expect(StyleSheet.flatten(surface.props.style)).toMatchObject({ width: 220, maxWidth: '100%' });
  expect(tree.root.findByType('AnimatedView' as React.ElementType).props.style.maxWidth).toBe('100%');
  const text = tree.root.findByType(Text);
  expect(text.props).toMatchObject({ numberOfLines: 3, maxFontSizeMultiplier: 1.2, accessibilityLabel: message, children: message });
  expect(text.props.allowFontScaling).not.toBe(false);
  act(() => tree.unmount());
});

it('overrides the speech preset fixed line height so enlarged text uses native font metrics', () => {
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<SpeechBubble text="Возвращаюсь!" tail="center" />); });
  const style = StyleSheet.flatten(tree.root.findByType(Text).props.style);
  expect(style.lineHeight).toBeUndefined();
  expect(style.includeFontPadding).toBe(false);
  act(() => tree.unmount());
});
