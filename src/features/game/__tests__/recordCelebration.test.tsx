import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useSettings } from '@/features/settings';

import { buildConfettiPieces, Confetti } from '../effects/Confetti';
import { NewRecordCelebration } from '../effects/NewRecordCelebration';
import { useGameStore } from '../store';

declare const __dirname: string;

const fs = jest.requireActual<{
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
}>('fs');

let mockReducedMotion = false;

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  class MockKeyframe {
    frames: Record<string, unknown>;
    durationMs = 0;
    delayMs = 0;

    constructor(frames: Record<string, unknown>) {
      this.frames = frames;
    }

    duration() {
      this.durationMs = arguments[0] as number;
      return this;
    }

    delay() {
      this.delayMs = arguments[0] as number;
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
    FadeIn: {
      duration() {
        return this;
      },
    },
    ZoomIn: {
      springify() {
        return this;
      },
      damping() {
        return this;
      },
    },
  };
});

jest.mock('../animation/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock('@/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');

  return {
    AppText: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(Text, props, children),
    BLOCK_THEMES: [{ cellColors: ['#F5C451', '#FFE27A', '#FFF6BA', '#FFFFFF'] }],
    colors: {
      accent: '#FFC93C',
      textPrimary: '#FFFFFF',
    },
    radii: {
      button: 16,
    },
  };
});

describe('record celebration source contract', () => {
  const gameSource = fs.readFileSync(`${__dirname}/../../../app/game.tsx`, 'utf8');
  const confettiSource = fs.readFileSync(`${__dirname}/../effects/Confetti.tsx`, 'utf8');
  const celebrationPath = `${__dirname}/../effects/NewRecordCelebration.tsx`;

  it('mounts a dedicated celebration layer above praise and below modal overlays', () => {
    expect(fs.existsSync(celebrationPath)).toBe(true);
    expect(gameSource.indexOf('<PraiseBanner />')).toBeGreaterThan(-1);
    expect(gameSource.indexOf('<NewRecordCelebration />')).toBeGreaterThan(
      gameSource.indexOf('<PraiseBanner />'),
    );
    expect(gameSource.indexOf('<NewRecordCelebration />')).toBeLessThan(
      gameSource.indexOf('<PauseOverlay'),
    );
    expect(gameSource.indexOf('<NewRecordCelebration />')).toBeLessThan(
      gameSource.indexOf('<GameOverOverlay'),
    );
  });

  it('keeps confetti configurable and deterministic instead of sampling Math.random at render time', () => {
    expect(confettiSource).toContain('buildConfettiPieces');
    expect(confettiSource).toContain('pieces?:');
    expect(confettiSource).toContain('count?:');
    expect(confettiSource).toContain('palette?:');
    expect(confettiSource).toContain('reducedMotion?:');
    expect(confettiSource).toContain('reducedMotion ?');
    expect(celebrationPath && fs.readFileSync(celebrationPath, 'utf8')).toContain(
      'reducedMotion={reducedMotion}',
    );
    expect(confettiSource).not.toContain('Math.random');
  });

  it('bounds the banner width and enables single-line text fitting for narrow screens', () => {
    const celebrationSource = fs.readFileSync(celebrationPath, 'utf8');

    expect(celebrationSource).toContain('maxWidth');
    expect(celebrationSource).toContain('paddingHorizontal');
    expect(celebrationSource).toContain('numberOfLines={1}');
    expect(celebrationSource).toContain('adjustsFontSizeToFit');
    expect(celebrationSource).toContain('minimumFontScale');
  });
});

describe('NewRecordCelebration', () => {
  const renderers: ReturnType<typeof create>[] = [];

  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
    act(() => {
      useSettings.setState({
        sound: true,
        haptics: true,
        praiseTone: 'classic',
        themeId: 'classic',
        lang: 'en',
      });
      useGameStore.getState().newGame({ seed: 7 });
      useGameStore.setState({ recordCelebration: null, recordCelebrated: false });
    });
  });

  afterEach(() => {
    act(() => {
      while (renderers.length > 0) {
        renderers.pop()!.unmount();
      }
    });
    jest.useRealTimers();
  });

  function mountCelebration() {
    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(React.createElement(NewRecordCelebration));
    });
    renderers.push(renderer!);
    return renderer!;
  }

  function beginCelebration(score = 128, previousBest = 120) {
    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score },
        recordCelebration: { score, previousBest },
        recordCelebrated: false,
      }));
    });
  }

  function confettiStyles(renderer: ReturnType<typeof create>) {
    const pieces = new Map<string, ReturnType<typeof StyleSheet.flatten>>();

    renderer.root
      .findAll(
        (node) =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('record-confetti-piece-'),
      )
      .forEach((node) => {
        pieces.set(node.props.testID, StyleSheet.flatten(node.props.style));
      });

    return [...pieces.values()];
  }

  function activeCelebrationCount(renderer: ReturnType<typeof create>) {
    return new Set(
      renderer.root
        .findAll((node) => node.props.testID === 'new-record-celebration')
        .map((node) => node.props.testID),
    ).size;
  }

  it('shows localized copy with deterministic capped gold confetti', () => {
    const first = mountCelebration();
    beginCelebration(256, 200);

    expect(first.root.findByProps({ testID: 'new-record-celebration' }).props.pointerEvents).toBe(
      'none',
    );
    expect(first.root.findByProps({ testID: 'new-record-title' }).props.children).toBe('New record!');
    expect(first.root.findByProps({ testID: 'new-record-score' }).props.children).toBe(256);
    expect(confettiStyles(first)).toHaveLength(18);
  });

  it('keeps the visible title and score width-bounded with single-line text fitting', () => {
    const renderer = mountCelebration();
    beginCelebration(12345, 12000);

    const title = renderer.root.findByProps({ testID: 'new-record-title' });
    const score = renderer.root.findByProps({ testID: 'new-record-score' });
    const scoreBanner = renderer.root.findByProps({ testID: 'new-record-score-shell' });
    const bannerStyle = StyleSheet.flatten(scoreBanner.props.style);

    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(title.props.minimumFontScale).toBeLessThan(1);
    expect(score.props.numberOfLines).toBe(1);
    expect(score.props.adjustsFontSizeToFit).toBe(true);
    expect(score.props.minimumFontScale).toBeLessThan(1);
    expect(bannerStyle.maxWidth).toBeDefined();
    expect(bannerStyle.paddingHorizontal).toBeGreaterThan(0);
  });

  it('keeps the visible celebration score pinned to the captured record score', () => {
    const renderer = mountCelebration();
    beginCelebration(256, 200);

    expect(renderer.root.findByProps({ testID: 'new-record-score' }).props.children).toBe(256);

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 512 },
      }));
    });

    expect(renderer.root.findByProps({ testID: 'new-record-score' }).props.children).toBe(256);
  });

  it('does not replay the same record event and clears its timer on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    const renderer = mountCelebration();
    const celebration = { score: 300, previousBest: 250 };

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: celebration.score },
        recordCelebration: celebration,
        recordCelebrated: false,
      }));
    });

    expect(activeCelebrationCount(renderer)).toBe(1);

    act(() => {
      jest.advanceTimersByTime(1300);
    });
    expect(activeCelebrationCount(renderer)).toBe(0);

    act(() => {
      useGameStore.setState({ recordCelebration: celebration, recordCelebrated: true });
    });
    expect(activeCelebrationCount(renderer)).toBe(0);

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 301 },
        recordCelebration: { score: 301, previousBest: 250 },
        recordCelebrated: false,
      }));
    });
    expect(activeCelebrationCount(renderer)).toBe(1);

    act(() => {
      renderer.unmount();
    });
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('exposes a deterministic confetti builder for the record path', () => {
    const first = buildConfettiPieces({
      count: 18,
      height: 220,
      palette: ['#F5C451', '#FFE27A', '#FFF6BA'],
      seed: 8128,
      testIdPrefix: 'record-confetti-piece-',
    });
    const second = buildConfettiPieces({
      count: 18,
      height: 220,
      palette: ['#F5C451', '#FFE27A', '#FFF6BA'],
      seed: 8128,
      testIdPrefix: 'record-confetti-piece-',
    });

    expect(second).toEqual(first);
    expect(first).toHaveLength(18);
  });

  it('uses reduced-motion confetti with no falling travel or rotation', () => {
    mockReducedMotion = true;

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(
        React.createElement(Confetti, {
          count: 1,
          height: 220,
          palette: ['#F5C451'],
          reducedMotion: true,
          testIdPrefix: 'record-confetti-piece-',
        }),
      );
    });
    renderers.push(renderer!);

    const piece = renderer!.root.find(
      (node) =>
        typeof node.props.testID === 'string' && node.props.testID === 'record-confetti-piece-0',
    );
    const entering = piece.props.entering as {
      frames: Record<string, { transform?: Record<string, number | string>[] }>;
    };

    expect(buildConfettiPieces({
      count: 1,
      height: 220,
      palette: ['#F5C451'],
      reducedMotion: true,
      testIdPrefix: 'record-confetti-piece-',
    })[0]).toEqual(
      expect.objectContaining({
        drift: 0,
        rotate: '0deg',
      }),
    );
    expect(JSON.stringify(entering.frames)).not.toContain('translateY');
    expect(JSON.stringify(entering.frames)).not.toContain('translateX');
    expect(JSON.stringify(entering.frames)).not.toContain('rotate');
    expect(JSON.stringify(entering.frames)).toContain('scale');
  });
});
