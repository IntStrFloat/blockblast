import React from 'react';
import { act, create } from 'react-test-renderer';
import type { SharedValue } from 'react-native-reanimated';

import { BoardCell } from '../components/BoardCell';
import { DragProvider, type DragCtx } from '../drag/DragContext';

const mockStyleRenders = jest.fn();
const mockStyles: (() => Record<string, unknown>)[] = [];

jest.mock('@/ui', () => ({ radii: { cell: 4 } }));

jest.mock('react-native-reanimated', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        ReactModule.createElement('animated-view', props, children),
    },
    useSharedValue: (initial: unknown) => ReactModule.useRef({ value: initial }).current,
    useAnimatedStyle: (factory: () => Record<string, unknown>) => {
      mockStyleRenders();
      const registered = ReactModule.useRef(false);
      if (!registered.current) {
        mockStyles.push(factory);
        registered.current = true;
      }
      return factory();
    },
    withTiming: (value: unknown) => value,
    withSequence: (...values: unknown[]) => values.at(-1),
    withDelay: (_delay: number, value: unknown) => value,
  };
});

const shared = <T,>(value: T) => ({ value }) as SharedValue<T>;

function context(): DragCtx {
  return {
    geom: { boardSize: 358, cell: 43, gap: 2, pad: 0 },
    boardOrigin: shared({ x: 0, y: 0 }),
    measureBoard: jest.fn(),
    boardMirror: shared(new Array(64).fill(0)),
    preview: shared(new Array(64).fill(0)),
    previewColor: shared(1),
    invalidPreview: shared(new Array(64).fill(0)),
    invalidReason: shared(0),
    clearPrelude: shared(0),
    dragActive: shared(0),
    dragOwner: shared(-1),
    cellColors: ['#45AAFF'],
    boardBg: '#101010',
    cellEmpty: '#222222',
    onDrop: jest.fn(() => true),
  };
}

beforeEach(() => {
  mockStyleRenders.mockClear();
  mockStyles.length = 0;
});

it('keeps unchanged cells out of gameplay callback and phase renders', () => {
  const original = context();
  const props = {
    index: 0, colorId: 0, size: 43, gap: 2, fillColor: '',
    emptyColor: '#222222', reducedMotion: false,
    visuals: original,
  };
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<DragProvider value={original}><BoardCell {...props} /></DragProvider>);
  });
  const stylesAtMount = mockStyleRenders.mock.calls.length;
  expect(stylesAtMount).toBeGreaterThan(0);

  act(() => renderer.update(
    <DragProvider value={{ ...original, onDrop: jest.fn(() => false) }}>
      <BoardCell {...props} />
    </DragProvider>,
  ));
  expect(mockStyleRenders).toHaveBeenCalledTimes(stylesAtMount);

  // Shared preview changes still update the registered UI style without a render.
  original.preview.value[0] = 3;
  original.clearPrelude.value = 1;
  expect(mockStyles.some((read) => read().opacity === 0.95)).toBe(true);
  expect(mockStyleRenders).toHaveBeenCalledTimes(stylesAtMount);
  act(() => renderer.unmount());
});

it('renders only the filled cell when a move changes one of the 64 board positions', () => {
  const original = context();
  const props = {
    colorId: 0, size: 43, gap: 2, fillColor: '',
    emptyColor: '#222222', reducedMotion: false,
    visuals: original,
  };
  const grid = (filled: boolean, ctx: DragCtx) => (
    <DragProvider value={ctx}>
      {Array.from({ length: 64 }, (_, index) => (
        <BoardCell
          key={index}
          {...props}
          index={index}
          colorId={filled && index === 0 ? 1 : 0}
          fillColor={filled && index === 0 ? '#45AAFF' : ''}
        />
      ))}
    </DragProvider>
  );
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(grid(false, original));
  });
  const stylesAtMount = mockStyleRenders.mock.calls.length;
  const stylesPerCell = stylesAtMount / 64;
  act(() => renderer.update(grid(true, { ...original, onDrop: jest.fn(() => true) })));
  expect(mockStyleRenders).toHaveBeenCalledTimes(stylesAtMount + stylesPerCell);
  act(() => renderer.unmount());
});
