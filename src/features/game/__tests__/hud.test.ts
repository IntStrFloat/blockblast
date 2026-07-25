import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useScores } from '@/features/scores';
import { useSettings } from '@/features/settings';
import { colors } from '@/ui';

import { Hud } from '../components/Hud';
import { useGameStore } from '../store';

declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');

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
    Easing: { out: (value: unknown) => value, cubic: 'cubic' },
    cancelAnimation: jest.fn(),
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    useAnimatedReaction: jest.fn(),
    useSharedValue: (value: unknown) => ({ value }),
    withTiming: (value: unknown) => value,
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
  useReducedMotion: () => false,
}));

describe('score HUD source contract', () => {
  const source = fs.readFileSync(`${__dirname}/../components/Hud.tsx`, 'utf8');

  it('counts the authoritative store score without a native text input fallback', () => {
    expect(source).toContain('useGameStore((s) => s.game.score)');
    expect(source).toContain('useAnimatedReaction(');
    expect(source).toContain('Easing.out(Easing.cubic)');
    expect(source).toMatch(/<AppText[^>]*preset="score"[^>]*>\s*{displayedScore}\s*<\/AppText>/);
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
    expect(source).toContain('testID={`hud-score-pulse-${pulseKey}`}');
  });

  it('reserves fixed vertical space for the combo badge when it is hidden', () => {
    expect(source).toContain('COMBO_BADGE_RESERVED_HEIGHT');
    expect(source).toContain('HUD_RESERVED_HEIGHT');
    expect(source).toContain('testID="hud-combo-slot"');
    expect(source).toMatch(/height:\s*HUD_RESERVED_HEIGHT/);
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
  beforeEach(() => {
    act(() => {
      useSettings.setState({ lang: 'en' });
      useScores.setState({ best: 42, gamesPlayed: 0, totalLinesCleared: 0 });
      useGameStore.getState().newGame({ seed: 7 });
      useGameStore.setState({ recordCelebrated: false });
    });
  });

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

  it('only remounts the score pulse for accepted score increases', () => {
    let renderer: ReturnType<typeof create> | null = null;

    act(() => {
      renderer = create(React.createElement(Hud, { onPause: () => {} }));
    });

    expect(pulseTestId(renderer!)).toBe('hud-score-pulse-0');

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 125 },
      }));
    });
    expect(pulseTestId(renderer!)).toBe('hud-score-pulse-1');

    act(() => {
      useScores.setState({ best: 99, gamesPlayed: 1, totalLinesCleared: 3 });
    });
    expect(pulseTestId(renderer!)).toBe('hud-score-pulse-1');

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 125 },
      }));
    });
    expect(pulseTestId(renderer!)).toBe('hud-score-pulse-1');

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 80 },
      }));
    });
    expect(pulseTestId(renderer!)).toBe('hud-score-pulse-1');

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

    const pulse = renderer!.root.findByProps({ testID: 'hud-score-pulse-1' });
    const pulseStyle = StyleSheet.flatten(pulse.props.style);
    expect(pulseStyle.transform).toEqual(
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

    const pulse = renderer!.root.findByProps({ testID: 'hud-score-pulse-3' });
    const pulseStyle = StyleSheet.flatten(pulse.props.style);
    expect(pulseStyle.transform).toEqual(
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
    const entering = pulse.props.entering as {
      frames: Record<string, { transform?: Record<string, number | string>[] }>;
    };
    const peaks = Object.values(entering.frames)
      .flatMap((frame) => frame.transform ?? [])
      .map((entry) => entry.scale)
      .filter((value): value is number => typeof value === 'number');

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
    expect(renderer!.root.findByProps({ testID: 'hud-best-value' }).props.children).toBe(2_120);

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
