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

const mockClearDebrisLayerSpy = jest.fn();
const mockGameEffectsLayerSpy = jest.fn();
const mockClearBurstLayerSpy = jest.fn();
const mockBoardFramePulseSpy = jest.fn();
const mockTriggerShakeSpy = jest.fn();

let mockBoardState: {
  game: { board: number[] };
  lastEvent: MockPlacementEvent | null;
};

const mockDragCtx = {
  geom: { boardSize: 94, cell: 10, gap: 2, pad: 0 },
  boardOrigin: { value: { x: 0, y: 0 } },
  measureBoard: jest.fn(),
  boardMirror: { value: [] as number[] },
  preview: { value: [] as number[] },
  previewColor: { value: 0 },
  invalidPreview: { value: [] as number[] },
  invalidReason: { value: 0 },
  clearPrelude: { value: 0 },
  cellColors: ['#ff4d67', '#ffc93c', '#4cc9ff'],
  boardBg: '#101010',
  cellEmpty: '#222222',
  onDrop: jest.fn(),
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
  budgetClearPresentations: (presentations: unknown[]) => presentations.slice(-2),
  buildClearPresentation: (event: MockPlacementEvent) => ({
    key: `presentation-${event.id}`,
    sequence: {
      tier: 'line_1',
      stages: [{ stage: 'impact', startMs: 145, endMs: 230 }],
      beams: [],
      motes: [],
      impact: null,
      reducedMotion: false,
    },
    debris: [],
    sparks: [],
    shards: [],
    centroid: { x: 0, y: 0 },
    shake: { amplitude: 0, scale: 1, durationMs: 0 },
    praiseFontSize: 0,
    reducedMotion: false,
    __lifetimeMs: event.clearLifetimeMs,
    __nodeCount: event.clearedCells.length > 0 ? 48 : 0,
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
    const remaining = Math.max(0, 96 - activeClearNodes);
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
  useDragCtx: () => mockDragCtx,
}));

jest.mock('../effects/ClearDebrisLayer', () => ({
  ClearDebrisLayer: (props: unknown) => {
    mockClearDebrisLayerSpy(props);
    return null;
  },
}));

jest.mock('../effects/BoardFramePulse', () => ({
  BoardFramePulse: (props: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    mockBoardFramePulseSpy(props);
    return React.createElement('board-frame-pulse', { testID: 'board-frame-pulse' });
  },
}));

jest.mock('../effects/GameEffectsLayer', () => ({
  GameEffectsLayer: (props: unknown) => {
    mockGameEffectsLayerSpy(props);
    return null;
  },
}));

jest.mock('../effects/ClearBurstLayer', () => ({
  ClearBurstLayer: (props: unknown) => {
    mockClearBurstLayerSpy(props);
    return null;
  },
}));

jest.mock('../effects/ClearSparkLayer', () => ({
  ClearSparkLayer: () => null,
}));

jest.mock('../effects/ClearChoreographyLayer', () => ({
  ClearChoreographyLayer: () => null,
}));

jest.mock('../effects/ComboAuraFrame', () => ({
  ComboAuraFrame: () => null,
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
    mockClearDebrisLayerSpy.mockClear();
    mockGameEffectsLayerSpy.mockClear();
    mockClearBurstLayerSpy.mockClear();
    mockBoardFramePulseSpy.mockClear();
    mockTriggerShakeSpy.mockClear();
    mockBoardState = {
      game: { board: Array.from({ length: 64 }, () => 0) },
      lastEvent: null,
    };
    mockDragCtx.boardMirror.value = [];
    mockDragCtx.preview.value = [];
    mockDragCtx.previewColor.value = 0;
    mockDragCtx.cellColors = ['#ff4d67', '#ffc93c', '#4cc9ff'];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders a frame-only pulse for combo clears without placement particles', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');
    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    mockBoardState.lastEvent = { ...makeEvent('combo-clear', 520), combo: 3 };
    act(() => {
      renderer!.update(<BoardView />);
    });

    expect(mockBoardFramePulseSpy).toHaveBeenCalled();
    expect(renderer!.root.findAllByProps({ testID: 'board-frame-pulse' })).toHaveLength(1);
    expect(mockBoardFramePulseSpy.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        presentation: expect.objectContaining({ intensity: 0.45, shakeAmplitude: 5 }),
      }),
    );
    expect(mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects ?? []).toHaveLength(0);
    act(() => renderer!.unmount());
  });

  it('clears a stale drag preview as soon as the committed board changes', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');
    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    mockDragCtx.preview.value = Array.from({ length: 64 }, (_, index) => (index % 3 === 0 ? 2 : 0));
    mockDragCtx.previewColor.value = 4;
    mockBoardState.game.board = Array.from({ length: 64 }, (_, index) => (index === 0 ? 1 : 0));
    act(() => {
      renderer!.update(<BoardView />);
    });

    expect(mockDragCtx.preview.value.every((value) => value === 0)).toBe(true);
    expect(mockDragCtx.previewColor.value).toBe(0);
    act(() => renderer!.unmount());
  });

  it('передаёт свежий клир в пул разрушения в том же коммите, где доска уже пуста', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    const callsBefore = mockClearBurstLayerSpy.mock.calls.length;
    mockBoardState.lastEvent = makeEvent('same-commit', 600);
    act(() => {
      renderer!.update(<BoardView />);
    });

    // Первый же рендер после события (доска в нём уже пустая) обязан
    // отдать презентацию пулу — ожидание очереди activePresentations
    // добавляло кадр «пустых» ячеек до появления осколков.
    const firstRenderProps = mockClearBurstLayerSpy.mock.calls[callsBefore]?.[0] as
      | { presentations?: readonly unknown[] }
      | undefined;
    expect(firstRenderProps?.presentations).toHaveLength(1);
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

    const firstPresentation = mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations?.[0];
    expect(firstPresentation).toBeDefined();

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    mockBoardState.lastEvent = makeEvent('b', 1000);
    act(() => {
      renderer!.update(<BoardView />);
    });

    const overlappingPresentations = mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? [];
    expect(overlappingPresentations).toHaveLength(2);
    expect(overlappingPresentations[0]?.id).toBe(firstPresentation.id);
    expect(overlappingPresentations[1]?.id).not.toBe(firstPresentation.id);

    await act(async () => {
      jest.advanceTimersByTime(401);
    });
    const afterFirstExpiry = mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? [];
    expect(afterFirstExpiry).toHaveLength(1);
    expect(afterFirstExpiry[0]?.id).not.toBe(firstPresentation.id);

    await act(async () => {
      jest.advanceTimersByTime(599);
    });

    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);  });

  it('allows an equivalent new clear event to be queued after the prior presentation expires', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');

    const replayableEvent = makeEvent('replay', 300);

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<BoardView />);
    });

    mockBoardState.lastEvent = { ...replayableEvent };
    act(() => {
      renderer!.update(<BoardView />);
    });

    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(301);
    });
    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);

    mockBoardState.lastEvent = null;
    act(() => {
      renderer!.update(<BoardView />);
    });

    mockBoardState.lastEvent = replayableEvent;
    act(() => {
      renderer!.update(<BoardView />);
    });

    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations).toHaveLength(1);
    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations?.[0]?.id).toBeDefined();
  });

  it.each(['clear', 'placement'])('does not replay expired %s effects when theme colors change', (kind) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');
    const next = makeEvent('retired', 100);
    let renderer: ReturnType<typeof create> | null = null;
    act(() => { renderer = create(<BoardView />); });
    mockBoardState.lastEvent = kind === 'clear'
      ? next
      : { ...next, clearedCells: [], clearedRows: [], clearedCols: [], clearedColors: [] };
    act(() => { renderer!.update(<BoardView />); });
    act(() => { jest.advanceTimersByTime(101); });
    const clearCount = () => (mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).length;
    const placementCount = () => (mockGameEffectsLayerSpy.mock.lastCall?.[0]?.placementEffects ?? []).length;
    expect(clearCount()).toBe(0);
    expect(placementCount()).toBe(0);
    mockTriggerShakeSpy.mockClear();
    mockDragCtx.cellColors = ['#123456', '#ABCDEF', '#654321'];
    act(() => { renderer!.update(<BoardView />); });
    expect(clearCount()).toBe(0);
    expect(placementCount()).toBe(0);
    expect(mockTriggerShakeSpy).not.toHaveBeenCalled();
    act(() => renderer!.unmount());
  });

  it('retires a clear already present when the board mounts', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BoardView } = require('../components/BoardView') as typeof import('../components/BoardView');
    mockBoardState.lastEvent = makeEvent('mount', 100);
    let renderer: ReturnType<typeof create> | null = null;
    act(() => { renderer = create(<BoardView />); });
    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations).toHaveLength(1);
    act(() => { jest.advanceTimersByTime(101); });
    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);
    act(() => renderer!.unmount());
  });

  it('keeps a three-clear burst bounded to two active presentations and 96 theoretical nodes', async () => {
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
    const firstBurstPresentation = mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations?.[0];
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

    const rapidBurstPresentations = mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? [];
    expect(rapidBurstPresentations).toHaveLength(2);
    expect(
      rapidBurstPresentations.map((presentation: { id: string }) => presentation.id),
    ).not.toContain(
      firstBurstPresentation?.id,
    );
    expect(rapidBurstPresentations.length * 48).toBeLessThanOrEqual(96);

    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(2);

    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);  });

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

    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(0);
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

  it('renders no placement effects when two active clears already consume the shared 96-node ceiling', async () => {
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

    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(2);
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

    expect(mockClearDebrisLayerSpy.mock.lastCall?.[0]?.presentations ?? []).toHaveLength(1);
    expect(totalPlacementNodes).toBeLessThanOrEqual(48);
    expect(placementEffects.length).toBeGreaterThan(0);
  });
});
