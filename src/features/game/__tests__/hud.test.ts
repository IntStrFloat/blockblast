import React from 'react';
import { StyleSheet } from 'react-native';
import * as ReactNative from 'react-native';
import { act, create } from 'react-test-renderer';

import { useScores } from '@/features/scores';
import { useSettings } from '@/features/settings';
import { colors } from '@/ui';

import { Hud } from '../components/Hud';
import { useGameStore } from '../store';
import { formatHudBestScore } from '../playfield-layout';

declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
let mockReducedMotion = false;
const mockTimings: { to: number; duration: number }[] = [];

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  class MockKeyframe {
    frames: Record<string, unknown>;

    constructor(frames: Record<string, unknown>) {
      this.frames = frames;
    }

    duration() {
      return this;
    }

    delay() {
      return this;
    }
  }

  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: React.ComponentType<any>) => Component,
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('animated-view', props, children),
    },
    Keyframe: MockKeyframe,
    Easing: { out: (value: unknown) => value, cubic: 'cubic', linear: (value: number) => value },
    cancelAnimation: jest.fn(),
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    useAnimatedReaction: jest.fn(),
    useSharedValue: (initial: number) => {
      const ref = React.useRef(null);
      if (!ref.current) {
        let value = initial;
        let animation: { from: number; to: number; startedAt: number; duration: number } | null = null;
        const shared = {
          get value(): number {
            if (!animation) return value;
            const progress = Math.max(0, Math.min(1, (Date.now() - animation.startedAt) / animation.duration));
            return animation.from + (animation.to - animation.from) * progress;
          },
          set value(next: number | { to: number; duration: number }) {
            if (typeof next === 'number') { value = next; animation = null; }
            else animation = { from: shared.value, to: next.to, duration: next.duration, startedAt: Date.now() };
          },
          get() { return shared.value; },
          set(next: number | { to: number; duration: number }) { shared.value = next; },
        };
        ref.current = shared;
      }
      return ref.current;
    },
    useAnimatedStyle: (read: () => Record<string, unknown>) => new Proxy({}, {
      get: (_target, key: string) => read()[key],
      ownKeys: () => Object.keys(read()),
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    }),
    withTiming: (to: number, config: { duration: number }) => {
      const timing = { to, duration: config.duration };
      mockTimings.push(timing);
      return timing;
    },
    interpolate: (value: number, input: number[], output: number[]) => {
      if (value <= input[0]!) return output[0];
      for (let index = 1; index < input.length; index += 1) {
        if (value <= input[index]!) {
          const progress = (value - input[index - 1]!) / (input[index]! - input[index - 1]!);
          return output[index - 1]! + (output[index]! - output[index - 1]!) * progress;
        }
      }
      return output.at(-1);
    },
  };
});

jest.mock('@/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');

  return {
    AppText: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(Text, props, children),
    CrownIcon: () => null,
    GearIcon: () => null,
    FireIcon: () => null,
    colors: {
      accent: '#FFC93C',
      textPrimary: '#FFFFFF',
      surface: 'rgba(255,255,255,0.08)',
    },
  };
});

jest.mock('../effects/ComboBadge', () => ({
  ComboBadge: () => null,
}));

jest.mock('../animation/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

describe('score HUD source contract', () => {
  const source = fs.readFileSync(`${__dirname}/../components/Hud.tsx`, 'utf8');

  it('renders the authoritative score without per-frame React updates', () => {
    expect(source).toContain('useGameStore((s) => s.game.score)');
    expect(source).not.toContain('useAnimatedReaction(');
    expect(source).not.toContain('runOnJS');
    expect(source).not.toContain('setDisplayedScore');
    expect(source).toMatch(/<AppText[^>]*preset="score"[^>]*>\s*{score}\s*<\/AppText>/);
    expect(source).not.toContain('TextInput');
    expect(source).not.toContain('AnimatedTextInput');
    expect(source).not.toContain('defaultValue="0"');
  });

  it('reserves a dedicated score shell and derives tier scaling from the locked helper', () => {
    expect(source).toContain('scoreScaleFor(score)');
    expect(source).toContain('GAME_FEEL_MOTION.scoreScaleMax');
    expect(source).toContain('minWidth');
    expect(source).toContain('Math.min(');
    expect(source).toContain('testID="hud-score-shell"');
    expect(source).toContain('testID="hud-score-pulse-0"');
    expect(source).not.toContain('setPulseKey');
    expect(source).not.toContain('setLastJump');
  });

  it('reserves fixed vertical space for the combo badge when it is hidden', () => {
    expect(source).toContain('layout.statusHeight');
    expect(source).toContain('layout.height');
    expect(source).toContain('testID="hud-combo-slot"');
    expect(source).toMatch(/height:\s*layout.height/);
  });

  it('renders the header controls without decorative cards or the best-score label', () => {
    expect(source).toContain('testID="hud-score-column"');
    expect(source).toContain('testID="hud-best"');
    expect(source).toContain('testID="hud-settings"');
    expect(source).not.toContain("t('game.best', lang)");
    expect(source).not.toContain('backgroundColor');
    expect(source).not.toContain('borderWidth');
    expect(source).not.toContain('shadowColor');
  });
});

describe('score HUD behavior', () => {
  it('keeps long authoritative numbers on one fitted line inside the score pulse budget', () => {
    act(() => {
      useScores.setState({ best: 98765432 });
      useGameStore.setState((state) => ({ game: { ...state.game, score: 12345678 } }));
    });
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(Hud, { compact: true, onPause: () => {} })); });
    const text = renderer.root.findByProps({ testID: 'hud-score-text' });
    const shell = StyleSheet.flatten(renderer.root.findByProps({ testID: 'hud-score-shell' }).props.style);
    const pulse = StyleSheet.flatten(renderer.root.findByProps({ testID: 'hud-score-pulse-0' }).props.style);
    expect(text.props.children).toBe(12345678);
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.adjustsFontSizeToFit).toBe(true);
    expect(pulse.width * 1.25).toBeLessThanOrEqual(shell.width);
    expect(pulse.height * 1.25).toBeLessThanOrEqual(shell.height);
    act(() => { renderer.unmount(); });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
    mockTimings.length = 0;
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 320, height: 568, scale: 1, fontScale: 1.6 });
    act(() => {
      useSettings.setState({ lang: 'en' });
      useScores.setState({ best: 42, gamesPlayed: 0, totalLinesCleared: 0 });
      useGameStore.getState().newGame({ seed: 7 });
      useGameStore.setState({ recordCelebrated: false });
    });
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  function pulseTestId(renderer: ReturnType<typeof create>) {
    return renderer.root.find(
      (node) =>
        typeof node.props.testID === 'string' && node.props.testID.startsWith('hud-score-pulse-'),
    ).props.testID as string;
  }

  function pulseNode(renderer: ReturnType<typeof create>) {
    return renderer.root.find(
      (node) =>
        typeof node.props.testID === 'string' && node.props.testID.startsWith('hud-score-pulse-'),
    );
  }

  it('retains the numeric Text and animated view identities when the score increases', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(Hud, { onPause: () => {} })); });
    const text = renderer.root.findByProps({ testID: 'hud-score-text' });
    const pulse = pulseNode(renderer);
    act(() => useGameStore.setState((state) => ({ game: { ...state.game, score: 125 } })));
    expect(renderer.root.findByProps({ testID: 'hud-score-text' })).toBe(text);
    expect(pulseNode(renderer)).toBe(pulse);
    expect(text.props.children).toBe(125);
    act(() => renderer.unmount());
  });

  it('pulses a normal increase on shared progress while keeping the full score opaque', () => {
    act(() => {
      useScores.setState({ best: 0 });
      useGameStore.getState().newGame({ seed: 7 });
    });
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(Hud, { onPause: () => {} })); });
    act(() => useGameStore.setState((state) => ({ game: { ...state.game, score: 100 } })));
    expect(mockTimings).toEqual([{ to: 1, duration: 220 }]);
    expect(renderer.root.findByProps({ testID: 'hud-score-text' }).props.children).toBe(100);
    act(() => jest.advanceTimersByTime(44));
    const peak = StyleSheet.flatten(pulseNode(renderer).props.style);
    expect(peak.opacity).toBe(1);
    expect(peak.transform[0].scale).toBeCloseTo(1.04);
    act(() => jest.advanceTimersByTime(176));
    expect(StyleSheet.flatten(pulseNode(renderer).props.style).transform[0].scale).toBe(1);
    act(() => renderer.unmount());
  });

  it('keeps the tier scale without starting a pulse under reduced motion', () => {
    mockReducedMotion = true;
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(Hud, { onPause: () => {} })); });
    const text = renderer.root.findByProps({ testID: 'hud-score-text' });
    act(() => useGameStore.setState((state) => ({ game: { ...state.game, score: 5000 } })));
    expect(mockTimings).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'hud-score-text' })).toBe(text);
    expect(StyleSheet.flatten(pulseNode(renderer).props.style)).toMatchObject({ opacity: 1, transform: [{ scale: 1.18 }] });
    act(() => renderer.unmount());
  });

  it.each([
    { lang: 'ru' as const, expected: '988млн' },
    { lang: 'en' as const, expected: '988M' },
  ])('keeps a long best readable and accessible in $lang while the main score stays exact', ({ lang, expected }) => {
    act(() => {
      useSettings.setState({ lang });
      useScores.setState({ best: 987654321 });
      useGameStore.getState().newGame({ seed: 7 });
      useGameStore.setState((state) => ({ game: { ...state.game, score: 123456789 } }));
    });
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(Hud, { compact: true, onPause: () => {} })); });
    const best = renderer.root.findByProps({ testID: 'hud-best-value' });
    expect(best.props.children).toBe(expected);
    expect(best.props.accessibilityLabel).toContain('987654321');
    expect(StyleSheet.flatten(best.props.style).fontSize).toBeGreaterThanOrEqual(12);
    expect(best.props.adjustsFontSizeToFit).toBeUndefined();
    expect(renderer.root.findByProps({ testID: 'hud-score-text' }).props.children).toBe(123456789);
    act(() => renderer.unmount());
  });

  it('keeps smaller best values exact and removes compact locale spacing', () => {
    expect(formatHudBestScore(999999, 'ru')).toBe('999999');
    expect(formatHudBestScore(1000000, 'ru')).toBe('1млн');
    expect(formatHudBestScore(987654321, 'ru')).not.toMatch(/\s/u);
  });

  it('starts a pulse only for score increases and leaves it idle on mount or unrelated updates', () => {
    let renderer: ReturnType<typeof create> | null = null;

    act(() => {
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
    });

    expect(pulseTestId(renderer!)).toBe('hud-score-pulse-0');
    expect(mockTimings).toHaveLength(0);

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 125 },
      }));
    });
    expect(pulseTestId(renderer!)).toBe('hud-score-pulse-0');
    expect(mockTimings).toHaveLength(1);

    act(() => {
      useScores.setState({ best: 99, gamesPlayed: 1, totalLinesCleared: 3 });
    });
    expect(mockTimings).toHaveLength(1);

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 125 },
      }));
    });
    expect(mockTimings).toHaveLength(1);

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 80 },
      }));
    });
    expect(mockTimings).toHaveLength(1);

    act(() => {
      renderer!.unmount();
    });
  });

  it('applies the locked score tiers and keeps the score gold after the run record is celebrated', () => {
    let renderer: ReturnType<typeof create> | null = null;

    act(() => {
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
    });

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 5000 },
      }));
    });

    act(() => jest.advanceTimersByTime(320));
    const pulse = renderer!.root.findByProps({ testID: 'hud-score-pulse-0' });
    expect(StyleSheet.flatten(pulse.props.style).transform).toEqual(
      expect.arrayContaining([expect.objectContaining({ scale: 1.18 })]),
    );

    act(() => {
      useGameStore.setState({ recordCelebrated: true });
    });

    const scoreText = renderer!.root.findByProps({ testID: 'hud-score-text' });
    const scoreTextStyle = StyleSheet.flatten(scoreText.props.style);
    expect(scoreTextStyle.color).toBe(colors.accent);

    act(() => {
      renderer!.unmount();
    });
  });

  it('keeps stable horizontal shell space across 999 -> 1000 and 9999 -> 10000', () => {
    let renderer: ReturnType<typeof create> | null = null;

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 999 },
      }));
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
    });

    const shellBefore = StyleSheet.flatten(renderer!.root.findByProps({ testID: 'hud-score-shell' }).props.style);
    expect(shellBefore.minWidth).toBeGreaterThan(0);
    expect(shellBefore.transform).toBeUndefined();

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 1000 },
      }));
    });
    const shellAtThousand = StyleSheet.flatten(
      renderer!.root.findByProps({ testID: 'hud-score-shell' }).props.style,
    );
    expect(shellAtThousand.minWidth).toBe(shellBefore.minWidth);
    expect(shellAtThousand.transform).toBeUndefined();

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 9999 },
      }));
    });
    const shellAt9999 = StyleSheet.flatten(renderer!.root.findByProps({ testID: 'hud-score-shell' }).props.style);
    expect(shellAt9999.minWidth).toBe(shellBefore.minWidth);

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 10000 },
      }));
    });
    const shellAt10000 = StyleSheet.flatten(
      renderer!.root.findByProps({ testID: 'hud-score-shell' }).props.style,
    );
    expect(shellAt10000.minWidth).toBe(shellBefore.minWidth);

    act(() => jest.advanceTimersByTime(320));
    const pulse = renderer!.root.findByProps({ testID: 'hud-score-pulse-0' });
    expect(StyleSheet.flatten(pulse.props.style).transform).toEqual(
      expect.arrayContaining([expect.objectContaining({ scale: 1.25 })]),
    );

    act(() => {
      renderer!.unmount();
    });
  });

  it('never peaks above the reserved max score scale during the pulse animation', () => {
    let renderer: ReturnType<typeof create> | null = null;

    act(() => {
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
    });

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 10000 },
      }));
    });

    const pulse = pulseNode(renderer!);
    const peaks: number[] = [];
    for (let frame = 0; frame <= 20; frame += 1) {
      const style = StyleSheet.flatten(pulse.props.style);
      peaks.push(style.transform[0].scale);
      expect(style.opacity).toBe(1);
      act(() => jest.advanceTimersByTime(16));
    }
    expect(pulse.props.entering).toBeUndefined();

    expect(peaks.length).toBeGreaterThan(0);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(1.25);

    act(() => {
      renderer!.unmount();
    });
  });

  it('keeps the combo row reserved even when the badge renders nothing', () => {
    let renderer: ReturnType<typeof create> | null = null;

    act(() => {
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
    });

    const comboSlotStyle = StyleSheet.flatten(
      renderer!.root.findByProps({ testID: 'hud-combo-slot' }).props.style,
    );
    expect(comboSlotStyle.height).toBeGreaterThan(0);
    expect(comboSlotStyle.justifyContent).toBe('center');

    act(() => {
      renderer!.unmount();
    });
  });

  it('shows pursuit, near and post-record status in the reserved slot', () => {
    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      useScores.setState({ best: 2_000, gamesPlayed: 2, totalLinesCleared: 0 });
      useGameStore.getState().newGame({ seed: 7 });
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
    });

    act(() => {
      useGameStore.setState((state) => ({ game: { ...state.game, score: 1_700 } }));
    });
    expect(renderer!.root.findByProps({ testID: 'hud-record-status' }).props.accessibilityLabel)
      .toBe('To record 301');

    act(() => {
      useGameStore.setState((state) => ({ game: { ...state.game, score: 1_900 } }));
    });
    expect(renderer!.root.findByProps({ testID: 'hud-record-status' }).props.accessibilityLabel)
      .toBe('To record 101');

    act(() => {
      useGameStore.setState((state) => ({ game: { ...state.game, score: 2_120 } }));
    });
    expect(renderer!.root.findByProps({ testID: 'hud-record-status' }).props.accessibilityLabel)
      .toBe('Record +120');
    expect(renderer!.root.findByProps({ testID: 'hud-best-value' }).props.children).toBe('2120');

    act(() => renderer!.unmount());
  });

  it('keeps record pursuit hidden on the first run', () => {
    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      useScores.setState({ best: 0, gamesPlayed: 0, totalLinesCleared: 0 });
      useGameStore.getState().newGame({ seed: 7 });
      useGameStore.setState((state) => ({ game: { ...state.game, score: 200 } }));
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
    });

    expect(renderer!.root.findAllByProps({ testID: 'hud-record-status' })).toHaveLength(0);
    act(() => renderer!.unmount());
  });

  it('drops the current record title immediately when a new run clears its celebration', () => {
    jest.useFakeTimers();
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(Hud, { onPause: () => {} })); });
    act(() => {
      useGameStore.setState((state) => ({ game: { ...state.game, score: 101 }, runBestAtStart: 100, recordCelebration: { score: 101, previousBest: 100 } }));
    });
    expect(renderer.root.findByProps({ testID: 'hud-record-status' }).props.accessibilityLabel).toBe('New record!');
    const label = renderer.root.findByProps({ testID: 'hud-record-status-text' });
    expect(label.props.allowFontScaling).toBe(false);
    expect(label.props.adjustsFontSizeToFit).toBeUndefined();
    expect(label.props.numberOfLines).toBe(2);
    act(() => { useGameStore.getState().newGame({ seed: 8 }); });
    expect(useGameStore.getState().recordCelebration).toBeNull();
    expect(renderer.root.findAllByProps({ testID: 'hud-record-status' }).every(
      (node) => node.props.accessibilityLabel !== 'New record!',
    )).toBe(true);
    act(() => { jest.advanceTimersByTime(3_000); renderer.unmount(); });
    jest.useRealTimers();
  });

  it('gives the one-shot record title priority before settling into live lead', () => {
    jest.useFakeTimers();
    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      useScores.setState({ best: 100, gamesPlayed: 2, totalLinesCleared: 0 });
      useGameStore.getState().newGame({ seed: 7 });
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 101 },
        recordCelebration: { score: 101, previousBest: 100 },
      }));
    });

    expect(renderer!.root.findByProps({ testID: 'hud-record-status' }).props.accessibilityLabel)
      .toBe('New record!');

    act(() => {
      jest.advanceTimersByTime(1_500);
    });
    expect(renderer!.root.findByProps({ testID: 'hud-record-status' }).props.accessibilityLabel)
      .toBe('Record +1');

    act(() => renderer!.unmount());
    jest.useRealTimers();
  });

  it('does not place the score, best score, or settings icon inside visible cards', () => {
    let renderer: ReturnType<typeof create> | null = null;

    act(() => {
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
    });

    for (const testID of ['hud-score-column', 'hud-best', 'hud-settings']) {
      const styleProp = renderer!.root.findByProps({ testID }).props.style;
      const style = StyleSheet.flatten(
        typeof styleProp === 'function' ? styleProp({ pressed: false }) : styleProp,
      );
      expect(style.backgroundColor).toBeUndefined();
      expect(style.borderWidth).toBeUndefined();
      expect(style.shadowColor).toBeUndefined();
      expect(style.elevation).toBeUndefined();
    }

    act(() => {
      renderer!.unmount();
    });
  });
});
