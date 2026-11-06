import React from 'react';
import { act, create } from 'react-test-renderer';

import type { PlacementEvent, PraiseTier } from '@/core/engine';

let mockReducedMotion = false;
let mockLang = 'en';
let mockShowMascot = true;
let mockStoreState: { lastEvent: PlacementEvent | null };
const mockDragCtx = {
  geom: { boardSize: 320, cell: 38, gap: 2 },
};

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: { children?: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('linear-gradient', props, children);
  },
}));

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  class MockKeyframe {
    frames: Record<number, Record<string, unknown>>;
    durationMs = 0;
    delayMs = 0;

    constructor(frames: Record<number, Record<string, unknown>>) {
      this.frames = frames;
    }

    duration(durationMs: number) {
      this.durationMs = durationMs;
      return this;
    }

    delay(delayMs: number) {
      this.delayMs = delayMs;
      return this;
    }
  }

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('animated-view', props, children),
    },
    Keyframe: MockKeyframe,
    Easing: { linear: (value: number) => value },
    ReduceMotion: { Never: 'never' },
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (factory: () => Record<string, unknown>) =>
      new Proxy(
        {},
        {
          get: (_target, key: string) => factory()[key],
          ownKeys: () => Object.keys(factory()),
          getOwnPropertyDescriptor: () => ({
            enumerable: true,
            configurable: true,
          }),
        },
      ),
    useSharedValue: (initial: number) => {
      const ref = React.useRef(null);
      if (!ref.current) {
        let value = initial;
        let animation: {
          from: number;
          to: number;
          start: number;
          duration: number;
        } | null = null;
        const shared = {
          get value(): number {
            if (!animation) return value;
            const progress = Math.max(
              0,
              Math.min(1, (Date.now() - animation.start) / animation.duration),
            );
            return animation.from + (animation.to - animation.from) * progress;
          },
          set value(
            next: number | { to: number; delay?: number; duration: number },
          ) {
            if (typeof next === 'number') {
              value = next;
              animation = null;
            } else
              animation = {
                from: shared.value,
                to: next.to,
                start: Date.now() + (next.delay ?? 0),
                duration: next.duration,
              };
          },
          get() {
            return shared.value;
          },
          set(next: number | { to: number; delay?: number; duration: number }) {
            shared.value = next;
          },
        };
        ref.current = shared;
      }
      return ref.current;
    },
    withDelay: (delay: number, animation: object) => ({ ...animation, delay }),
    withTiming: (to: number, config: { duration: number }) => ({
      to,
      duration: config.duration,
    }),
    interpolate: (value: number, input: number[], output: number[]) => {
      if (value <= input[0]!) return output[0];
      for (let i = 1; i < input.length; i++) {
        if (value <= input[i]!) {
          const fraction =
            (value - input[i - 1]!) / (input[i]! - input[i - 1]!);
          return output[i - 1]! + (output[i]! - output[i - 1]!) * fraction;
        }
      }
      return output[output.length - 1];
    },
  };
});

jest.mock('@/core/i18n', () => ({
  praiseText: (tier: PraiseTier) => `PRAISE_${tier}`,
  t: (key: string) =>
    key === 'game.combo' ? (mockLang === 'ru' ? 'Комбо' : 'COMBO') : key,
}));

jest.mock('@/features/settings', () => ({
  useSettings: (
    selector: (state: {
      praiseTone: 'classic';
      showMascot: boolean;
    }) => unknown,
  ) => selector({ praiseTone: 'classic', showMascot: mockShowMascot }),
  useLang: () => mockLang,
}));

jest.mock('@/ui', () => ({
  ...jest.requireActual('@/ui/nightCandy'),
  CandyIcon: 'CandyIcon',
  AppText: ({ children, ...props }: { children?: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('app-text', props, children);
  },
}));

jest.mock('../animation/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock('../drag/DragContext', () => ({
  useDragCtx: () => mockDragCtx,
}));

jest.mock('../store', () => ({
  useGameStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

// Mocks must be registered before the component module is evaluated.
// eslint-disable-next-line import/first
import { PraiseBanner } from '../effects/PraiseBanner';

function event(overrides: Partial<PlacementEvent> = {}): PlacementEvent {
  return {
    placed: [
      [3, 3],
      [3, 4],
    ],
    colorId: 2,
    clearedRows: [3],
    clearedCols: [],
    clearedCells: Array.from({ length: 8 }, (_, col) => [3, col] as const),
    clearedColors: Array.from({ length: 8 }, () => 2),
    scoreDelta: 240,
    score: 1000,
    combo: 2,
    praise: 'great',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
    ...overrides,
  };
}

function textContent(renderer: ReturnType<typeof create>) {
  return renderer.root
    .findAll((node) => (node.type as unknown) === 'app-text')
    .map((node) => node.props.children)
    .flat()
    .join(' ');
}

function feedbackStyle(
  renderer: ReturnType<typeof create>,
  testID = 'clear-praise',
) {
  const node = renderer.root
    .findAllByProps({ testID })
    .find((item) => (item.type as unknown) === 'animated-view')!;
  return Object.assign({}, ...[node.props.style].flat());
}

describe('PraiseBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
    mockLang = 'en';
    mockShowMascot = true;
    mockStoreState = { lastEvent: null };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders praise lettering without combo-number layout when combo is below two', () => {
    let renderer: ReturnType<typeof create> | null = null;

    act(() => {
      renderer = create(<PraiseBanner />);
    });

    mockStoreState.lastEvent = event({ combo: 1, praise: 'good' });
    act(() => {
      renderer!.update(<PraiseBanner />);
    });

    expect(textContent(renderer!)).toContain('PRAISE_good');
    expect(textContent(renderer!)).not.toContain('COMBO');
    expect(
      renderer!.root.findAllByProps({ testID: 'combo-celebration' }),
    ).toHaveLength(0);

    act(() => renderer!.unmount());
  });

  it('honors the companion setting without losing score feedback', () => {
    mockShowMascot = false;
    mockStoreState.lastEvent = event();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PraiseBanner />);
    });
    expect(
      renderer.root.findAllByProps({ testID: 'clear-capy-praise' }),
    ).toHaveLength(0);
    expect(textContent(renderer).replaceAll(' ', '')).toContain('+240');
    act(() => renderer.unmount());
  });

  it('uses a bundled Cyrillic font for the Russian combo label', () => {
    let renderer: ReturnType<typeof create> | null = null;
    mockLang = 'ru';
    mockStoreState.lastEvent = event();
    act(() => {
      renderer = create(<PraiseBanner />);
    });
    const labels = renderer!.root.findAll(
      (node) =>
        (node.type as unknown) === 'app-text' &&
        [node.props.children].flat().join('').startsWith('Комбо'),
    );
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.props.style.fontFamily).toBe('Unbounded_900Black');
    }
    act(() => renderer!.unmount());
  });

  it('drops sweep and particles under reduced motion while keeping the banner text', () => {
    let renderer: ReturnType<typeof create> | null = null;
    mockReducedMotion = true;

    act(() => {
      renderer = create(<PraiseBanner />);
    });

    mockStoreState.lastEvent = event({ combo: 5, praise: 'great' });
    act(() => {
      renderer!.update(<PraiseBanner />);
    });

    expect(textContent(renderer!)).toContain('COMBO');
    expect(
      renderer!.root.findAllByProps({ testID: 'combo-celebration' }),
    ).toHaveLength(0);
    expect(
      renderer!.root.findAll(
        (node) => (node.type as unknown) === 'linear-gradient',
      ),
    ).toHaveLength(0);
    expect(
      renderer!.root.findAllByProps({ testID: 'combo-particle-0' }),
    ).toHaveLength(0);
    expect(
      renderer!.root.findAllByProps({ testID: 'combo-ray-0' }),
    ).toHaveLength(0);

    act(() => renderer!.unmount());
  });

  it('does not replay the same clear event across rerenders', () => {
    let renderer: ReturnType<typeof create> | null = null;
    const stableEvent = event({ combo: 4, praise: 'great' });

    act(() => {
      renderer = create(<PraiseBanner />);
    });

    mockStoreState.lastEvent = stableEvent;
    act(() => {
      renderer!.update(<PraiseBanner />);
    });
    const firstText = textContent(renderer!);
    const firstCelebrationCount = renderer!.root.findAllByProps({
      testID: 'combo-celebration',
    }).length;

    act(() => {
      renderer!.update(<PraiseBanner />);
    });

    expect(
      renderer!.root.findAllByProps({ testID: 'combo-celebration' }),
    ).toHaveLength(firstCelebrationCount);
    expect(textContent(renderer!)).toBe(firstText);

    act(() => renderer!.unmount());
  });

  it('renders the current clear that is already present at mount time', () => {
    let renderer: ReturnType<typeof create> | null = null;
    mockStoreState.lastEvent = event({ combo: 3, praise: 'great' });

    act(() => {
      renderer = create(<PraiseBanner />);
    });

    expect(
      renderer!.root.findAllByProps({ testID: 'clear-praise' }).length,
    ).toBeGreaterThan(0);
    expect(textContent(renderer!)).toContain('COMBO');
    expect(textContent(renderer!)).toContain('3');

    act(() => renderer!.unmount());
  });

  it('starts hidden, fades once and stays hidden across late rerenders', () => {
    mockStoreState.lastEvent = event({ combo: 5 });
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PraiseBanner />);
    });
    expect(feedbackStyle(renderer).opacity ?? 1).toBe(0);
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(feedbackStyle(renderer).opacity).toBe(0);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(feedbackStyle(renderer).opacity).toBe(1);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    const fading = feedbackStyle(renderer).opacity;
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
    act(() => {
      renderer.update(<PraiseBanner />);
      jest.advanceTimersByTime(100);
    });
    expect(feedbackStyle(renderer).opacity).toBe(0);
    act(() => {
      jest.advanceTimersByTime(2000);
      renderer.update(<PraiseBanner />);
    });
    expect(feedbackStyle(renderer).opacity).toBe(0);
    expect(feedbackStyle(renderer, 'clear-score').opacity).toBe(0);
    act(() => renderer.unmount());
  });

  it('starts a quick follow-up combo hidden without inheriting the previous opacity', () => {
    mockStoreState.lastEvent = event({ combo: 5 });
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PraiseBanner />);
      jest.advanceTimersByTime(450);
    });
    act(() => {
      jest.advanceTimersByTime(450);
    });
    mockStoreState.lastEvent = event({ combo: 6 });
    act(() => {
      renderer.update(<PraiseBanner />);
    });
    expect(feedbackStyle(renderer).opacity ?? 1).toBe(0);
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(feedbackStyle(renderer).opacity).toBe(1);
    act(() => renderer.unmount());
  });

  it('uses a short fade with no scale or drift under reduced motion', () => {
    mockReducedMotion = true;
    mockStoreState.lastEvent = event();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PraiseBanner />);
    });
    expect(feedbackStyle(renderer).opacity ?? 1).toBe(0);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(feedbackStyle(renderer).opacity).toBe(1);
    expect(feedbackStyle(renderer).transform).toEqual([
      { translateY: 0 },
      { scale: 1 },
      { rotate: '0deg' },
    ]);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(feedbackStyle(renderer).opacity).toBe(0);
    act(() => renderer.unmount());
  });

  it('consumes a clear suppressed at mount and shows the next real event without replay', () => {
    mockStoreState.lastEvent = event({ combo: 3 });
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PraiseBanner suppressed />);
    });
    expect(renderer.toJSON()).toBeNull();
    act(() => {
      jest.advanceTimersByTime(2000);
      renderer.update(<PraiseBanner />);
    });
    expect(renderer.toJSON()).toBeNull();

    mockStoreState.lastEvent = event({ combo: 4, score: 1240 });
    act(() => {
      renderer.update(<PraiseBanner />);
    });
    expect(textContent(renderer)).toContain('4');
    expect(feedbackStyle(renderer).opacity).toBe(0);
    act(() => jest.advanceTimersByTime(400));
    expect(feedbackStyle(renderer).opacity).toBe(1);
    act(() => renderer.unmount());
  });

  it('retires an interrupted visible clear and consumes follow-up clears while suppressed', () => {
    mockStoreState.lastEvent = event({ combo: 3 });
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PraiseBanner />);
    });
    act(() => jest.advanceTimersByTime(400));
    expect(feedbackStyle(renderer).opacity).toBe(1);

    act(() => renderer.update(<PraiseBanner suppressed />));
    expect(renderer.toJSON()).toBeNull();
    mockStoreState.lastEvent = event({ combo: 4 });
    act(() => renderer.update(<PraiseBanner suppressed />));
    mockStoreState.lastEvent = event({ combo: 5 });
    act(() => renderer.update(<PraiseBanner suppressed />));
    act(() => renderer.update(<PraiseBanner />));
    expect(renderer.toJSON()).toBeNull();

    // An equivalent-looking new placement still owns a fresh presentation.
    mockStoreState.lastEvent = event({ combo: 5 });
    act(() => renderer.update(<PraiseBanner />));
    expect(textContent(renderer)).toContain('5');
    act(() => renderer.unmount());
  });

  it('allows the authored Capy speech bubble above the board', () => {
    mockStoreState.lastEvent = event({ combo: 10, clearedCells: [[0, 3]] });
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PraiseBanner />);
    });
    expect(
      renderer.root.findByProps({ testID: 'board-praise-bounds' }).props.style,
    ).toMatchObject({ inset: 0, width: 320, height: 320, overflow: 'visible' });
    act(() => renderer.unmount());
  });
});
