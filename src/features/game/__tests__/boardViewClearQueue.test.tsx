import React from 'react';
import { act, create } from 'react-test-renderer';

import { GAME_FEEL_MOTION } from '../animation/motion';

type MockPlacementEvent = {
  id: string;
  clearLifetimeMs: number;
  placementLifetimeMs: number;
  placed: readonly (readonly [number, number])[];
  clearedCells: readonly (readonly [number, number])[];
  clearedRows: readonly number[];
  clearedCols: readonly number[];
  clearedColors: readonly number[];
  colorId: number;
  scoreDelta: number;
  score: number;
  combo: number;
  praise: 'none';
  onFire: boolean;
  boardCleared: boolean;
  newTray: boolean;
  gameOver: boolean;
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
    __lifetimeMs: event.clearLifetimeMs,
    __nodeCount: event.clearedCells.length > 0 ? 64 : 0,
  }),
  clearPresentationLifetimeMs: (presentation: { __lifetimeMs?: number } | null) =>
    presentation?.__lifetimeMs ?? 0,
  countAnimatedClearNodes: (presentation: { __nodeCount?: number } | null) =>
    presentation?.__nodeCount ?? 0,
}));

jest.mock('../animation/gameFeelPresentation', () => ({
  buildPlacementPresentation: (event: MockPlacementEvent) => ({
    anchor: { x: 12, y: 18 },
    particles: Array.from({ length: 12 }, (_, index) => ({
      id: `particle-${event.id}-${index}`,
      x: 12,
      y: 18,
      size: 4,
      color: '#ff4d67',
      dx: 0,
      dy: 0,
      rotateDeg: 0,
      delayMs: 0,
      durationMs: 200,
    })),
    burstScale: 1.04,
    flashAlpha: 0.2,
    scoreScale: 1,
    reducedMotion: false,
    __lifetimeMs: event.placementLifetimeMs,
  }),
  comboFrameFor: (event: MockPlacementEvent) => ({
    intensity: event.combo >= 2 ? 0.45 : 0,
    lineStrength: event.clearedRows.length + event.clearedCols.length > 0 ? 0.5 : 0,
    boardClearStrength: event.boardCleared ? 1 : 0,
    shakeAmplitude: event.combo >= 3 ? 5 : 0,
    shakeDurationMs: event.combo >= 3 ? 165 : 0,
    scale: event.combo >= 3 ? 1.12 : 1,
    reducedMotion: false,
    __lifetimeMs: event.placementLifetimeMs,
  }),
  countAnimatedPlacementNodes: (effect: {
    placement?: { particles?: unknown[] } | null;
    comboFrame?: { intensity?: number } | null;
  }) => 1 + (effect.placement?.particles?.length ?? 0) + ((effect.comboFrame?.intensity ?? 0) > 0 ? 1 : 0),
  budgetPlacementEffects: (
    activeClearNodes: number,
    placementEffects: {
      id: string;
      placement?: { particles?: unknown[] } | null;
      comboFrame?: { intensity?: number } | null;
    }[],
  ) => {
    const remaining = Math.max(0, 128 - activeClearNodes);
    const kept: typeof placementEffects = [];
    let used = 0;
    [...placementEffects].reverse().forEach((effect) => {
      const count = 1 + (effect.placement?.particles?.length ?? 0) + ((effect.comboFrame?.intensity ?? 0) > 0 ? 1 : 0);
      if (used + count > remaining) return;
      used += count;
      kept.unshift(effect);
    });
    return kept;
  },
  placementEffectLifetimeMs: (
    placement: { __lifetimeMs?: number } | null,
    comboFrame: { __lifetimeMs?: number } | null,
  ) => Math.max(placement?.__lifetimeMs ?? 0, comboFrame?.__lifetimeMs ?? 0),
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

jest.mock('../effects/ClearBurstLayer', () => ({
  ClearBurstLayer: () => null,
}));

function makeEvent(id: string, lifetimeMs: number): MockPlacementEvent {
  return {
    id,
    clearLifetimeMs: lifetimeMs,
    placementLifetimeMs: lifetimeMs,
    placed: [
      [3, 3],
      [3, 4],
      [4, 3],
    ],
    clearedCells: Array.from({ length: 8 }, (_, col) => [3, col] as const),
    clearedRows: [3],
    clearedCols: [],
    clearedColors: Array.from({ length: 8 }, () => 1),
    colorId: 1,
    scoreDelta: 32,
    score: 512,
    combo: 1,
    praise: 'none',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
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

  it('queues placement effects for accepted no-clear moves and releases them after expiry', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');

    const noClearMove = {
      ...makeEvent('placement-a', 260),
      clearLifetimeMs: 0,
      placementLifetimeMs: 260,
      clearedCells: [],
      clearedRows: [],
      clearedCols: [],
      clearedColors: [],
      combo: 2,
    };

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    mockBoardState.lastEvent = noClearMove;
    act(() => {
      renderer!.update(<BoardView />);
    });

    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);
    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects ?? []).toHaveLength(1);
    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects?.[0]?.placement?.particles).toHaveLength(12);
    expect(mockTriggerShakeSpy).toHaveBeenLastCalledWith({
      clear: null,
      combo: expect.objectContaining({ intensity: 0.45, shakeAmplitude: 0 }),
    });

    await act(async () => {
      jest.advanceTimersByTime(261);
    });

    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects ?? []).toHaveLength(0);
  });

  it('keeps rapid placement bursts bounded by the separate placement queue cap', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    const events = [
      { ...makeEvent('p1', 700), clearLifetimeMs: 0, placementLifetimeMs: 700, clearedCells: [], clearedRows: [], clearedCols: [], clearedColors: [], combo: 1 },
      { ...makeEvent('p2', 800), clearLifetimeMs: 0, placementLifetimeMs: 800, clearedCells: [], clearedRows: [], clearedCols: [], clearedColors: [], combo: 2 },
      { ...makeEvent('p3', 900), clearLifetimeMs: 0, placementLifetimeMs: 900, clearedCells: [], clearedRows: [], clearedCols: [], clearedColors: [], combo: 3 },
      { ...makeEvent('p4', 1000), clearLifetimeMs: 0, placementLifetimeMs: 1000, clearedCells: [], clearedRows: [], clearedCols: [], clearedColors: [], combo: 4 },
    ];

    let firstPlacementEffectId: string | undefined;

    mockBoardState.lastEvent = events[0];
    act(() => {
      renderer!.update(<BoardView />);
    });
    firstPlacementEffectId = mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects?.[0]?.id;

    events.slice(1).forEach((event) => {
      act(() => {
        jest.advanceTimersByTime(40);
      });
      mockBoardState.lastEvent = event;
      act(() => {
        renderer!.update(<BoardView />);
      });
    });

    const placementEffects = mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects ?? [];
    expect(placementEffects).toHaveLength(GAME_FEEL_MOTION.placementQueueCap);
    expect(
      placementEffects.map((effect: { id: string }) => effect.id),
    ).not.toContain(firstPlacementEffectId);
    expect(mockTriggerShakeSpy).toHaveBeenLastCalledWith({
      clear: null,
      combo: expect.objectContaining({ shakeAmplitude: 5, scale: 1.12 }),
    });

    await act(async () => {
      jest.advanceTimersByTime(1001);
    });

    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects ?? []).toHaveLength(0);
  });

  it('renders no placement effects when two active clears already consume the shared 128-node ceiling', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    mockBoardState.lastEvent = makeEvent('clear-a', 800);
    act(() => {
      renderer!.update(<BoardView />);
    });

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    mockBoardState.lastEvent = makeEvent('clear-b', 900);
    act(() => {
      renderer!.update(<BoardView />);
    });

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    mockBoardState.lastEvent = {
      ...makeEvent('placement-after-clears', 700),
      clearLifetimeMs: 0,
      placementLifetimeMs: 700,
      clearedCells: [],
      clearedRows: [],
      clearedCols: [],
      clearedColors: [],
      combo: 2,
    };
    act(() => {
      renderer!.update(<BoardView />);
    });

    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(2);
    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects ?? []).toHaveLength(0);
  });

  it('keeps placement effects within the remaining shared budget after one active clear', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    mockBoardState.lastEvent = makeEvent('clear-a', 900);
    act(() => {
      renderer!.update(<BoardView />);
    });

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    ['p1', 'p2', 'p3', 'p4', 'p5'].forEach((id) => {
      mockBoardState.lastEvent = {
        ...makeEvent(id, 700),
        clearLifetimeMs: 0,
        placementLifetimeMs: 700,
        clearedCells: [],
        clearedRows: [],
        clearedCols: [],
        clearedColors: [],
        combo: 2,
      };
      act(() => {
        renderer!.update(<BoardView />);
      });
    });

    const placementEffects = mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects ?? [];
    const totalPlacementNodes = placementEffects.reduce(
      (sum: number, effect: { placement?: { particles?: unknown[] }; comboFrame?: { intensity?: number } }) =>
        sum + 1 + (effect.placement?.particles?.length ?? 0) + ((effect.comboFrame?.intensity ?? 0) > 0 ? 1 : 0),
      0,
    );

    expect(mockClearLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(1);
    expect(totalPlacementNodes).toBeLessThanOrEqual(64);
    expect(placementEffects.length).toBeGreaterThan(0);
  });
});
