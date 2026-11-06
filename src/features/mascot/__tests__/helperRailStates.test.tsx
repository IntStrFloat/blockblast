import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { HelperHint } from '../components/HelperHint';
import { HelperSwap } from '../components/HelperSwap';

const mockBefore = { board: Array(64).fill(0), tray: [{ shape: { cells: [[0, 0]] } }], score: 1 };
let mockGame = mockBefore;
let mockCharges = 99;
let mockFree = true;
const mockUseHelper = jest.fn(() => true);
const mockRestore = jest.fn((game: typeof mockBefore) => { mockGame = game; });
const mockPreview = { value: [] as number[] };
const mockPreviewColor = { value: 1 };
const mockHintPresentation = jest.fn();
jest.mock('@/features/game', () => ({
  EMPTY_MASK: [], previewMask: () => [1],
  useDragCtx: () => ({ preview: mockPreview, previewColor: mockPreviewColor }),
  useGameStore: Object.assign(
    (select: (state: object) => unknown) => select({ game: mockGame }),
    { setState: (value: unknown) => mockHintPresentation(value), getState: () => ({
      game: mockGame, epoch: 1,
      replaceTrayPiece: () => { mockGame = { ...mockGame, score: 2 }; },
      restoreGame: mockRestore,
    }) },
  ),
}));
jest.mock('../store', () => ({ useMascot: Object.assign(
  (select: (state: object) => unknown) => select({
    helpersUsedDay: { hint: 'today', swap: 'today' }, helperCharges: { hint: mockCharges, swap: mockCharges },
  }),
  { getState: () => ({ useHelper: mockUseHelper, helperCharges: { hint: mockCharges, swap: mockCharges } }) },
) }));
jest.mock('../logic/helpers', () => ({ isStuckish: () => true, findHintMove: () => ({ trayIndex: 0, r: 0, c: 0 }), findSwapTarget: () => 0 }));
jest.mock('../logic/rules', () => ({ canUseHelper: () => mockFree }));
jest.mock('@/features/progression', () => ({ isHelperUnlocked: () => true, useProgression: (select: (state: object) => unknown) => select({ level: 30 }) }));
jest.mock('@/features/analytics', () => ({ useAnalyticsStore: { getState: () => ({ activeRun: null, track: jest.fn(), trackOnce: jest.fn() }) } }));
jest.mock('@/features/settings', () => ({ useLang: () => 'ru', useSettings: { getState: () => ({ sound: false }) } }));
jest.mock('@/features/streak', () => ({ todayISO: () => 'today' }));
jest.mock('@/features/monetization', () => ({ getAds: () => ({}), loadAdsMeta: () => ({}), recordFullscreenCooldown: (value: object) => value, saveAdsMeta: jest.fn() }));
jest.mock('@/features/monetization/useRewardedReady', () => ({ useRewardedReady: () => true }));
jest.mock('@/features/monetization/rewardedBenefits', () => ({ claimRewardedBenefit: jest.fn() }));
jest.mock('@/ui', () => ({ ...jest.requireActual('@/ui/theme'), AppText: 'AppText' }));
jest.mock('react-native-gesture-handler', () => ({ Pressable: 'GesturePressable' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, FadeIn: {}, FadeOut: {} }));

function enlargedLineBudget(text: ReactTestInstance) {
  expect(text.props.maxFontSizeMultiplier).toBe(1.2);
  expect(text.props.allowFontScaling).toBe(false);
  expect(text.props.adjustsFontSizeToFit).toBeUndefined();
  expect(text.props.minimumFontScale).toBeUndefined();
  const style = StyleSheet.flatten(text.props.style);
  expect(style.includeFontPadding).toBe(false);
  // Narrow utility cells use fixed type even when the device font scale is 1.6.
  return style.lineHeight * text.props.numberOfLines;
}

function contentHeight(node: ReactTestInstance) {
  const style = StyleSheet.flatten(node.props.style);
  return style.height - 2 * (style.paddingVertical ?? 0);
}

describe('bounded helper states', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => {
    jest.useFakeTimers();
    mockGame = mockBefore; mockCharges = 99; mockFree = true;
    mockUseHelper.mockClear(); mockRestore.mockClear();
  });
  afterEach(() => { if (tree) act(() => tree.unmount()); jest.useRealTimers(); });

  it.each([true, false])('keeps two-line video disclosure fixed and readable without native autoshrink (compact=%s)', (compact) => {
    mockCharges = 0; mockFree = false;
    act(() => { tree = create(<><HelperHint onEmote={jest.fn()} reduceMotion compact={compact} /><HelperSwap onEmote={jest.fn()} reduceMotion compact={compact} /></>); });
    for (const id of ['helper-hint', 'helper-swap']) {
      const button = tree.root.findByProps({ testID: id });
      expect(button.props.accessibilityLabel).toContain('за видео');
      expect(StyleSheet.flatten(button.props.style)).toMatchObject({ width: '100%', minHeight: 44 });
      const label = button.findByType('AppText' as React.ElementType);
      expect(label.props).toMatchObject({ numberOfLines: 2, maxFontSizeMultiplier: 1.2 });
      expect(label.props.children).toContain('\nза видео');
      expect(label.props.children).not.toContain('🎬');
      expect(label.props.children).toBe(`${id === 'helper-hint' ? 'подсказка' : 'замена'}\nза видео`);
      expect(enlargedLineBudget(label)).toBeLessThanOrEqual(contentHeight(label.parent!));
    }
  });

  it('keeps a hint receipt in the same 44dp slot after the action succeeds', () => {
    act(() => { tree = create(<HelperHint onEmote={jest.fn()} reduceMotion compact />); });
    act(() => tree.root.findByProps({ testID: 'helper-hint' }).props.onPress());
    const result = tree.root.findByProps({ testID: 'helper-hint-result' });
    expect(StyleSheet.flatten(result.props.style)).toMatchObject({ width: '100%', height: 44 });
    const label = result.findByType('AppText' as React.ElementType);
    expect(label.props.numberOfLines).toBe(2);
    expect(enlargedLineBudget(label)).toBeLessThanOrEqual(contentHeight(result));
    expect(mockUseHelper).toHaveBeenCalledTimes(1);
    expect(mockHintPresentation).toHaveBeenCalledWith({ helperHint: { trayIndex: 0, r: 0, c: 0 } });
    expect(mockPreview.value).toEqual([]);
  });

  it('uses the whole 44dp Undo card and restores the snapshot without charging', () => {
    act(() => { tree = create(<HelperSwap onEmote={jest.fn()} reduceMotion compact />); });
    act(() => tree.root.findByProps({ testID: 'helper-swap' }).props.onPress());
    const undo = tree.root.findByProps({ testID: 'helper-swap-undo' });
    const button = undo.findByType('GesturePressable' as React.ElementType);
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ width: '100%', minHeight: 44, height: 44 });
    const textHeight = button.findAllByType('AppText' as React.ElementType)
      .reduce((total, label) => total + enlargedLineBudget(label), 0);
    expect(textHeight).toBeLessThanOrEqual(contentHeight(button));
    act(() => button.props.onPress());
    expect(mockRestore).toHaveBeenCalledWith(mockBefore);
    expect(mockUseHelper).not.toHaveBeenCalled();
  });

  it('settles an unused Undo once and keeps the resulting receipt bounded', () => {
    act(() => { tree = create(<HelperSwap onEmote={jest.fn()} reduceMotion compact />); });
    act(() => tree.root.findByProps({ testID: 'helper-swap' }).props.onPress());
    act(() => jest.advanceTimersByTime(1101));
    expect(mockUseHelper).toHaveBeenCalledTimes(1);
    const result = tree.root.findByProps({ testID: 'helper-swap-result' });
    expect(StyleSheet.flatten(result.props.style)).toMatchObject({ height: 44, width: '100%' });
    expect(enlargedLineBudget(result.findByType('AppText' as React.ElementType))).toBeLessThanOrEqual(contentHeight(result));
    act(() => jest.advanceTimersByTime(2000));
    expect(mockUseHelper).toHaveBeenCalledTimes(1);
  });
});
