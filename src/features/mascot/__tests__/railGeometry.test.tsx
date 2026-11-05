import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import type { SharedValue } from 'react-native-reanimated';

import { HelperControls } from '../components/HelperControls';
import { MascotLayer, MascotMessages } from '../components/MascotLayer';
import { MascotChip } from '../components/MascotChip';

let mockShowMascot = true;
jest.mock('@/ui', () => ({ ...jest.requireActual('@/ui/theme'), AppText: 'AppText' }));
jest.mock('@/features/settings', () => ({
  useLang: () => 'ru',
  useSettings: (select: (value: object) => unknown) => select({ showMascot: mockShowMascot, praiseTone: 'classic' }),
}));
jest.mock('@/features/progression', () => ({
  stageForLevel: () => 3,
  progressFor: () => ({ level: 123, pointsInLevel: 20, pointsToNext: 80 }),
  useProgression: (select: (value: object) => unknown) => select({ level: 123, lifetimePoints: 300 }),
}));
jest.mock('@/features/game', () => ({ useGameStore: Object.assign(
  (select: (value: object) => unknown) => select({ epoch: 1 }),
  { getState: () => ({}) },
) }));
jest.mock('../store', () => ({ useMascot: Object.assign(
  (select: (value: object) => unknown) => select({ equipped: {}, lost: false, introDone: true }),
  { getState: () => ({ lost: false }) },
) }));
jest.mock('../hooks/useMascotBrain', () => ({ useMascotBrain: () => {} }));
jest.mock('../hooks/useMascotFeedback', () => ({ useMascotFeedback: () => ({ onLost: () => {}, onTap: () => {} }) }));
jest.mock('../components/HelperHint', () => ({ HelperHint: 'HelperHint' }));
jest.mock('../components/HelperSwap', () => ({ HelperSwap: 'HelperSwap' }));
jest.mock('../components/MascotIntro', () => ({ MascotIntro: 'MascotIntro' }));
jest.mock('../components/SpeechBubble', () => ({ SpeechBubble: 'SpeechBubble' }));
jest.mock('../components/Wardrobe', () => ({ Wardrobe: () => null }));
jest.mock('../components/MascotArt', () => ({ MascotMark: 'MascotMark' }));
jest.mock('../components/Mascot', () => ({
  Mascot: 'Mascot',
  useMascotMotion: () => Object.fromEntries(['x', 'bob', 'scaleX', 'scaleY', 'facing', 'rotate', 'eyeOpen', 'opacity'].map((key) => [key, { value: 0 }])),
}));
jest.mock('react-native-gesture-handler', () => ({
  Pressable: 'GesturePressable',
  GestureHandlerRootView: 'GestureRoot',
  GestureDetector: 'GestureDetector',
  Gesture: {
    Tap: () => { const g = { enabled: () => g, onEnd: () => g }; return g; },
    Pan: () => { const g = { enabled: () => g, onBegin: () => g, onChange: () => g, onEnd: () => g, onFinalize: () => g }; return g; },
    Race: () => ({}),
  },
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useSharedValue: (value: unknown) => ({ value }),
  useAnimatedStyle: (read: () => object) => read(),
  useAnimatedReaction: () => {},
  cancelAnimation: () => {},
  runOnJS: (callback: unknown) => callback,
  withTiming: (value: unknown) => value,
  withSequence: (...values: unknown[]) => values.at(-1),
  withSpring: (value: unknown) => value,
}));
jest.mock('@/features/game/animation/useReducedMotion', () => ({ useReducedMotion: () => false }));

beforeEach(() => { mockShowMascot = true; });

it.each([
  { compact: true, width: 104, height: 48 },
  { compact: false, width: 144, height: 70 },
])('keeps mascot and level-chip touch bounds disjoint in the $height dp rail', (layout) => {
  const props = { ...layout, dragActive: { value: 0 } as SharedValue<number> };
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<MascotLayer {...props} />); });
  const art = StyleSheet.flatten(tree.root.findByProps({ testID: 'mascot-art-slot' }).props.style);
  const chip = StyleSheet.flatten(tree.root.findByProps({ testID: 'mascot-chip-slot' }).props.style);
  expect(art.left + art.width).toBeLessThanOrEqual(chip.left);
  expect(chip.left + chip.width).toBeLessThanOrEqual(layout.width);
  expect(art.height).toBeLessThanOrEqual(layout.height);
  expect(chip.height).toBeLessThanOrEqual(layout.height);
  const gesture = tree.root.findByType('GestureDetector' as React.ElementType);
  const hit = StyleSheet.flatten(gesture.props.children.props.style);
  const gestureParent = StyleSheet.flatten(gesture.parent!.props.style);
  expect(hit.width).toBeGreaterThanOrEqual(44);
  expect(hit.height).toBeGreaterThanOrEqual(44);
  expect(gestureParent.width).toBeGreaterThanOrEqual(hit.width);
  expect(gestureParent.height).toBeGreaterThanOrEqual(hit.height);
  expect(tree.root.findAllByType('MascotIntro' as React.ElementType)).toHaveLength(0);
  act(() => tree.unmount());
});

it.each([
  { width: 184, compact: true, height: 48 },
  { width: 217, compact: false, height: 70 },
])('fits two helper slots inside their own $width dp allocation without covering the mascot', (layout) => {
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<HelperControls {...layout} />); });
  const root = StyleSheet.flatten(tree.root.findByProps({ testID: 'helper-controls' }).props.style);
  const hint = StyleSheet.flatten(tree.root.findByProps({ testID: 'helper-hint-slot' }).props.style);
  const swap = StyleSheet.flatten(tree.root.findByProps({ testID: 'helper-swap-slot' }).props.style);
  expect(root.position).not.toBe('absolute');
  expect(root.width).toBe(layout.width);
  expect(hint.width + swap.width + 6).toBeLessThanOrEqual(layout.width);
  expect(hint.height).toBeGreaterThanOrEqual(44);
  expect(hint.height).toBeLessThanOrEqual(layout.height);
  act(() => tree.unmount());
});

it('keeps functional helpers rendered when mascot art is disabled', () => {
  mockShowMascot = false;
  const props = { width: 184, height: 48, compact: true };
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<HelperControls {...props} />); });
  expect(tree.root.findAllByType('HelperHint' as React.ElementType)).toHaveLength(1);
  expect(tree.root.findAllByType('HelperSwap' as React.ElementType)).toHaveLength(1);
  act(() => tree.unmount());
});

it('opens the wardrobe in its own gesture root and closes on Android Back', () => {
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<MascotLayer dragActive={{ value: 0 } as SharedValue<number>} compact width={104} height={48} />); });
  act(() => tree.root.findByProps({ testID: 'mascot-chip' }).props.onPress());
  const modal = tree.root.findByType(Modal);
  expect(modal.props.visible).toBe(true);
  expect(tree.root.findAllByType('GestureRoot' as React.ElementType)).toHaveLength(1);
  act(() => modal.props.onRequestClose());
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
  act(() => tree.unmount());
});

it('exposes decorative events without putting speech or Skip inside the rail', () => {
  const ready = jest.fn();
  const lost = jest.fn();
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<MascotLayer dragActive={{ value: 0 } as SharedValue<number>} onEmoteReady={ready} onLostTextChange={lost} />); });
  expect(ready.mock.lastCall?.[0]).toEqual(expect.any(Function));
  expect(lost).toHaveBeenCalledWith(null);
  act(() => ready.mock.lastCall?.[0]('heart'));
  expect(tree.root.findAllByType('SpeechBubble' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findAllByType('MascotIntro' as React.ElementType)).toHaveLength(0);
  act(() => tree.unmount());
  expect(ready.mock.lastCall?.[0]).toBeNull();
  expect(lost.mock.lastCall?.[0]).toBeNull();
});

it('renders intro or lost speech only in the separately mounted message component', () => {
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<MascotMessages />); });
  expect(tree.root.findAllByType('MascotIntro' as React.ElementType)).toHaveLength(1);
  act(() => tree.update(<MascotMessages lostText="Возвращаюсь" />));
  expect(tree.root.findAllByType('MascotIntro' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findByType('SpeechBubble' as React.ElementType).props.text).toBe('Возвращаюсь');
  act(() => tree.update(<MascotMessages active={false} lostText="Возвращаюсь" />));
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});

it.each([
  { compact: true, width: 56 },
  { compact: false, width: 80 },
])('keeps a readable fixed-size level row above its progress bar (compact=$compact)', (layout) => {
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<MascotChip {...layout} onPress={jest.fn()} />); });
  const button = tree.root.findByProps({ testID: 'mascot-chip' });
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minHeight: 44, width: layout.width });
  expect(button.props.accessibilityLabel).toContain('Уровень 123');
  expect(button.props.accessibilityLabel).toContain('20 из 100');
  const label = button.findByType('AppText' as React.ElementType);
  expect(label.props.allowFontScaling).toBe(false);
  expect(label.props.adjustsFontSizeToFit).toBeUndefined();
  expect(label.props.minimumFontScale).toBeUndefined();
  expect(StyleSheet.flatten(label.props.style)).toMatchObject({ fontSize: 11, lineHeight: 14, includeFontPadding: false });
  expect(button.findAllByType('MascotMark' as React.ElementType)).toHaveLength(layout.compact ? 0 : 1);
  const pill = button.props.children;
  expect(StyleSheet.flatten(pill.props.style).flexDirection).not.toBe('row');
  const [caption, track] = pill.props.children;
  expect(StyleSheet.flatten(caption.props.style)).toMatchObject({ flexDirection: 'row', gap: 4, width: '100%' });
  expect(StyleSheet.flatten(track.props.style)).toMatchObject({ width: 40, height: 4 });
  expect(StyleSheet.flatten(track.props.children.props.style).width).toBe('20%');
  act(() => tree.unmount());
});
