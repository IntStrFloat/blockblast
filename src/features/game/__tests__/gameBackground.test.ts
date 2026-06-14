import mockReact from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, View as mockView } from 'react-native';

import { GameBackground } from '../components/GameBackground';
import { useGameStore } from '../store';

declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');

const read = (relativePath: string) =>
  fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

let mockReducedMotionValue = false;

jest.mock('expo-linear-gradient', () => {
  return {
    LinearGradient: ({ children, ...props }: any) =>
      mockReact.createElement(mockView, props, children),
  };
});

jest.mock('react-native-reanimated', () => {
  class KeyframeMock {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
    duration(ms: number) {
      return { type: 'Keyframe', duration: ms, config: this.config };
    }
  }

  const makeTiming = (type: string) => ({
    duration: (ms: number) => ({ type, duration: ms }),
  });

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) =>
        mockReact.createElement(mockView, props, children),
    },
    FadeIn: makeTiming('FadeIn'),
    FadeOut: makeTiming('FadeOut'),
    Keyframe: KeyframeMock,
  };
});

jest.mock('../animation/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotionValue,
}));

const gameSource = read('../../../app/game.tsx');
const homeSource = read('../../../app/index.tsx');
const backgroundSource = read('../components/GameBackground.tsx');

type BoardLayout = { x: number; y: number; width: number; height: number };

const BOARD_SIZE = 320;
const BOARD_LAYOUT: BoardLayout = {
  x: 64,
  y: 112,
  width: 320,
  height: 320,
};

function comboEvent(score: number, combo = 2): any {
  return {
    scoreDelta: 120,
    score,
    combo,
  };
}

function renderBackground(boardLayout: BoardLayout | null = BOARD_LAYOUT) {
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(
      mockReact.createElement(GameBackground, {
        boardSize: BOARD_SIZE,
        boardLayout,
      }),
    );
  });
  return renderer!;
}

function pulseNode(tree: TestRenderer.ReactTestRenderer) {
  return (
    tree.root.findAll(
      (node) => node.props.pointerEvents === 'none' && node.props.entering != null,
    )[0] ?? null
  );
}

function haloNode(tree: TestRenderer.ReactTestRenderer) {
  return (
    tree.root.findAll(
      (node) =>
        Array.isArray(node.props.colors) &&
        String(node.props.colors[0] ?? '').includes('167,210,255'),
    )[0] ?? null
  );
}

describe('GameBackground contract', () => {
  beforeEach(() => {
    mockReducedMotionValue = false;
    jest.useFakeTimers();
    act(() => {
      useGameStore.setState({ lastEvent: null });
    });
  });

  afterEach(() => {
    act(() => {
      useGameStore.setState({ lastEvent: null });
    });
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('mounts only from the game route', () => {
    expect(gameSource).toContain("from '@/features/game/components/GameBackground'");
    expect(gameSource).toContain('<GameBackground');
    expect(gameSource).toContain('boardLayout={boardLayout}');
    expect(gameSource).toContain('onLayout={handleBoardLayout}');
    expect(homeSource).not.toContain('GameBackground');
  });

  it('uses a restrained soft-sunset backdrop stack with a dark indigo fallback', () => {
    expect(backgroundSource).toContain('LinearGradient');
    expect(backgroundSource).toContain('pointerEvents="none"');
    expect(backgroundSource).toContain('absoluteFill');
    expect(backgroundSource).toContain('boardLayout');
    expect(backgroundSource).toContain('#0E1736');
    expect(backgroundSource).toContain('#F6B39F');
    expect(backgroundSource).toContain('#E98BAC');
    expect(backgroundSource).toContain('#425E9E');
    expect(backgroundSource).toContain('#A7D2FF');
  });

  it('reacts only to combo events and cleans up stale pulses', () => {
    expect(backgroundSource).toContain('useGameStore((state) => state.lastEvent)');
    expect(backgroundSource).toContain('combo < 2');
    expect(backgroundSource).toContain('setTimeout');
    expect(backgroundSource).toContain('clearTimeout');
    expect(backgroundSource).toContain('return clearPulseTimer');
    expect(backgroundSource).not.toContain('setInterval');
    expect(backgroundSource).not.toContain('withRepeat');
    expect(backgroundSource).not.toContain('repeat(');
  });

  it('keeps reduced motion to opacity-only fades without travel', () => {
    expect(backgroundSource).toContain('useReducedMotion');
    expect(backgroundSource).toContain('reducedMotion');
    expect(backgroundSource).toContain('opacity');
    expect(backgroundSource).toContain('scale');
    expect(backgroundSource).not.toContain('translateY');
    expect(backgroundSource).not.toContain('translateX');
  });

  it('fires a brief combo pulse and stops after the timeout', () => {
    const tree = renderBackground();

    act(() => {
      useGameStore.setState({ lastEvent: comboEvent(140, 2) });
    });

    expect(pulseNode(tree)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(pulseNode(tree)).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(pulseNode(tree)).toBeNull();

    act(() => {
      tree.unmount();
    });
  });

  it('does not pulse for non-combo clears', () => {
    const tree = renderBackground();

    act(() => {
      useGameStore.setState({ lastEvent: comboEvent(200, 1) });
    });

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(pulseNode(tree)).toBeNull();

    act(() => {
      tree.unmount();
    });
  });

  it('resets pulse identity when the session clears so the next same score can pulse again', () => {
    const tree = renderBackground();

    act(() => {
      useGameStore.setState({ lastEvent: comboEvent(240, 2) });
    });

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(pulseNode(tree)).not.toBeNull();

    act(() => {
      useGameStore.setState({ lastEvent: null });
    });

    expect(pulseNode(tree)).toBeNull();

    act(() => {
      useGameStore.setState({ lastEvent: comboEvent(240, 2) });
    });

    expect(pulseNode(tree)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(pulseNode(tree)).not.toBeNull();

    act(() => {
      tree.unmount();
    });
  });

  it('cleans up pending timers on unmount', () => {
    const tree = renderBackground();

    act(() => {
      useGameStore.setState({ lastEvent: comboEvent(260, 2) });
    });

    expect(jest.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      tree.unmount();
    });

    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses the measured board layout for the halo anchor and reduced-motion animation', () => {
    mockReducedMotionValue = true;
    const tree = renderBackground(BOARD_LAYOUT);
    const halo = haloNode(tree);

    expect(halo).not.toBeNull();
    expect(StyleSheet.flatten(halo.props.style)).toMatchObject({
      left: BOARD_LAYOUT.x + BOARD_LAYOUT.width / 2 - BOARD_SIZE * 1.74 / 2,
      top: BOARD_LAYOUT.y + BOARD_LAYOUT.height / 2 - BOARD_SIZE * 1.18 / 2,
    });

    act(() => {
      useGameStore.setState({ lastEvent: comboEvent(320, 2) });
    });

    act(() => {
      jest.advanceTimersByTime(0);
    });

    const pulse = pulseNode(tree);
    expect(pulse).not.toBeNull();
    expect(pulse.props.entering).toEqual(expect.objectContaining({ type: 'FadeIn', duration: 120 }));
    expect(pulse.props.exiting).toEqual(expect.objectContaining({ type: 'FadeOut', duration: 100 }));

    act(() => {
      tree.unmount();
    });
  });
});
