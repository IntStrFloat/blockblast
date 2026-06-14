import React from 'react';
import { act, create } from 'react-test-renderer';

type MockPlacementEvent = {
  id: string;
  lifetimeMs: number;
  clearedCells: readonly (readonly [number, number])[];
};

const mockClearLayerSpy = jest.fn();
const mockGameEffectsLayerSpy = jest.fn();
const mockTriggerShakeSpy = jest.fn();

let mockBoardState: {
  game: { board: number[] };
  lastEvent: MockPlacementEvent | null;
};

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: React.ComponentType<unknown>) => Component,
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('animated-view', props, children),
    },
  };
});

jest.mock('../components/BoardCell', () => ({
  BoardCell: () => null,
}));

jest.mock('../animation/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../effects/useShake', () => ({
  useShake: () => ({
    shakeStyle: {},
    triggerShake: mockTriggerShakeSpy,
  }),
}));

jest.mock('../animation/clearPresentation', () => ({
  MAX_ACTIVE_CLEAR_PRESENTATIONS: 2,
  buildClearPresentation: (event: MockPlacementEvent) => ({
    key: `presentation-${event.id}`,
    lines: [],
    intersections: [],
    fragments: [],
    fallingFragments: [],
    debris: [],
    sparks: [],
    centroid: { x: 0, y: 0 },
    shake: { amplitude: 0, scale: 1, durationMs: 0 },
    praiseFontSize: 0,
    reducedMotion: false,
    __lifetimeMs: event.lifetimeMs,
  }),
  clearPresentationLifetimeMs: (presentation: { __lifetimeMs?: number } | null) =>
    presentation?.__lifetimeMs ?? 0,
}));

jest.mock('../store', () => ({
  useGameStore: (selector: (state: typeof mockBoardState) => unknown) => selector(mockBoardState),
}));

jest.mock('../drag/DragContext', () => ({
  useDragCtx: () => ({
    geom: { boardSize: 94, cell: 10, gap: 2, pad: 0 },
    boardOrigin: { value: { x: 0, y: 0 } },
    boardMeasureRef: { current: null },
    boardMirror: { value: [] },
    preview: { value: [] },
    previewColor: { value: 0 },
    cellColors: ['#ff4d67', '#ffc93c', '#4cc9ff'],
    boardBg: '#101010',
    cellEmpty: '#222222',
    onDrop: jest.fn(),
  }),
}));

jest.mock('../effects/ClearLayer', () => ({
  ClearLayer: (props: unknown) => {
    mockClearLayerSpy(props);
    return null;
  },
}));

jest.mock('../effects/GameEffectsLayer', () => ({
  GameEffectsLayer: (props: unknown) => {
    mockGameEffectsLayerSpy(props);
    return null;
  },
}));

function makeEvent(id: string, lifetimeMs: number): MockPlacementEvent {
  return {
    id,
    lifetimeMs,
    clearedCells: Array.from({ length: 8 }, (_, col) => [3, col] as const),
  };
}

describe('BoardView clear presentation queue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockClearLayerSpy.mockClear();
    mockGameEffectsLayerSpy.mockClear();
    mockTriggerShakeSpy.mockClear();
    mockBoardState = {
      game: { board: Array.from({ length: 64 }, () => 0) },
      lastEvent: null,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps overlapping clear presentations alive independently until each lifetime ends', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    mockBoardState.lastEvent = makeEvent('a', 600);
    act(() => {
      renderer!.update(<BoardView />);
    });

    const firstPresentation = mockClearLayerSpy.mock.lastCall?.[0]?.presentations?.[0];
    expect(firstPresentation).toBeDefined();

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    mockBoardState.lastEvent = makeEvent('b', 1000);
    act(() => {
      renderer!.update(<BoardView />);
    });

    const overlappingPresentations = mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? [];
    expect(overlappingPresentations).toHaveLength(2);
    expect(overlappingPresentations[0]?.id).toBe(firstPresentation.id);
    expect(overlappingPresentations[1]?.id).not.toBe(firstPresentation.id);
    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.presentations).toHaveLength(2);

    await act(async () => {
      jest.advanceTimersByTime(401);
    });
    const afterFirstExpiry = mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? [];
    expect(afterFirstExpiry).toHaveLength(1);
    expect(afterFirstExpiry[0]?.id).not.toBe(firstPresentation.id);

    await act(async () => {
      jest.advanceTimersByTime(599);
    });

    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);
    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);
  });

  it('releases an expired presentation id so the same instance can be queued again later', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');

    const replayableEvent = makeEvent('replay', 300);

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    mockBoardState.lastEvent = replayableEvent;
    act(() => {
      renderer!.update(<BoardView />);
    });

    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(301);
    });
    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);

    mockBoardState.lastEvent = null;
    act(() => {
      renderer!.update(<BoardView />);
    });

    mockBoardState.lastEvent = replayableEvent;
    act(() => {
      renderer!.update(<BoardView />);
    });

    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations).toHaveLength(1);
    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations?.[0]?.id).toBeDefined();
  });

  it('keeps a three-clear burst bounded to two active presentations and 128 theoretical nodes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    mockBoardState.lastEvent = makeEvent('a', 300);
    act(() => {
      renderer!.update(<BoardView />);
    });
    const firstBurstPresentation = mockClearLayerSpy.mock.lastCall?.[0]?.presentations?.[0];
    expect(firstBurstPresentation).toBeDefined();

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    mockBoardState.lastEvent = makeEvent('b', 600);
    act(() => {
      renderer!.update(<BoardView />);
    });

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    mockBoardState.lastEvent = makeEvent('c', 900);
    act(() => {
      renderer!.update(<BoardView />);
    });

    const rapidBurstPresentations = mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? [];
    expect(rapidBurstPresentations).toHaveLength(2);
    expect(
      rapidBurstPresentations.map((presentation: { id: string }) => presentation.id),
    ).not.toContain(
      firstBurstPresentation?.id,
    );
    expect(rapidBurstPresentations.length * 64).toBeLessThanOrEqual(128);
    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(2);

    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(2);

    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);
    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);
  });
});
