/**
 * Seamless-destruction contract: every cleared cell has frame-zero coverage,
 * while its crack, travel and fade may still be delayed by the shared timeline.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

import type { PlacementEvent } from '@/core/engine';

import { buildClearPresentation } from '../animation/clearPresentation';

interface MockSharedValue {
  value: unknown;
  __history: unknown[];
}

const mockSharedValues: MockSharedValue[] = [];

interface TimingMarker {
  __kind: 'timing';
  to: unknown;
}

interface SequenceMarker {
  __kind: 'sequence';
  steps: unknown[];
}

interface DelayMarker {
  __kind: 'delay';
  delayMs: number;
  target: unknown;
}

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('animated-view', props, children),
    },
    cancelAnimation: jest.fn(),
    Easing: {
      bezier: () => (value: number) => value,
      in: (value: unknown) => value,
      out: (value: unknown) => value,
      quad: 'quad',
      cubic: 'cubic',
    },
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (initial: unknown) => {
      let current = initial;
      const history: unknown[] = [];
      const shared: MockSharedValue = {
        get value() {
          return current;
        },
        set value(next: unknown) {
          current = next;
          history.push(next);
        },
        __history: history,
      };
      mockSharedValues.push(shared);
      return shared;
    },
    withTiming: (to: unknown): TimingMarker => ({ __kind: 'timing', to }),
    withSequence: (...steps: unknown[]): SequenceMarker => ({ __kind: 'sequence', steps }),
    withDelay: (delayMs: number, target: unknown): DelayMarker => ({
      __kind: 'delay',
      delayMs,
      target,
    }),
  };
});

function isTiming(value: unknown): value is TimingMarker {
  return !!value && (value as TimingMarker).__kind === 'timing';
}

function isSequence(value: unknown): value is SequenceMarker {
  return !!value && (value as SequenceMarker).__kind === 'sequence';
}

function isDelay(value: unknown): value is DelayMarker {
  return !!value && (value as DelayMarker).__kind === 'delay';
}

function delayedContainsTimingTo(value: unknown, to: unknown): boolean {
  if (!isDelay(value)) return false;
  const walk = (node: unknown): boolean => {
    if (isTiming(node)) return node.to === to;
    if (isSequence(node)) return node.steps.some(walk);
    if (isDelay(node)) return walk(node.target);
    return false;
  };
  return walk(value.target);
}

const CELL_COLORS = ['#ff4d67', '#ffc93c', '#4cc9ff'];
const GEOM = { boardSize: 94, cell: 10, gap: 2 };

function twoRowEvent(): PlacementEvent {
  const clearedCells = [
    ...Array.from({ length: 8 }, (_, col) => [3, col] as const),
    ...Array.from({ length: 8 }, (_, col) => [4, col] as const),
  ];
  return {
    placed: [[3, 3], [3, 4], [4, 3], [4, 4]],
    colorId: 2,
    clearedRows: [3, 4],
    clearedCols: [],
    clearedCells,
    clearedColors: clearedCells.map((_, index) => (index % 3) + 1),
    scoreDelta: 240,
    score: 940,
    combo: 2,
    praise: 'great',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
  };
}

function expectFullCoverage(event: PlacementEvent) {
  const presentation = buildClearPresentation(event, GEOM, CELL_COLORS, false);
  const step = GEOM.cell + GEOM.gap;
  for (const [row, col] of event.clearedCells) {
    const x = col * step;
    const y = row * step;
    const pieces = presentation.shards.filter(
      (shard) =>
        shard.x >= x &&
        shard.x < x + GEOM.cell &&
        shard.y >= y &&
        shard.y < y + GEOM.cell,
    );
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0))
      .toBeCloseTo(GEOM.cell * GEOM.cell);
  }
}

describe('burst coverage of cleared cells', () => {
  it('tiles every cleared cell of a normal multi-line clear', () => {
    expectFullCoverage(twoRowEvent());
  });

  it('keeps coverage for a clear larger than the split-upgrade budget', () => {
    const clearedCells = Array.from(
      { length: 40 },
      (_, index) => [Math.floor(index / 8), index % 8] as const,
    );
    expectFullCoverage({
      ...twoRowEvent(),
      clearedRows: [0, 1, 2, 3, 4],
      clearedCells,
      clearedColors: clearedCells.map((_, index) => (index % 3) + 1),
    });
  });
});

const SHARD = {
  id: 'shard-0-0',
  x: 12,
  y: 24,
  width: 5,
  height: 10,
  color: '#ff4d67',
  flashColor: '#FFD2DA',
  delay: 30,
  duration: 160,
};

function presentationWith(key: string) {
  return {
    key,
    sequence: { segments: [], beams: [], motes: [], impact: null },
    debris: [],
    sparks: [],
    shards: [SHARD],
    centroid: { x: 0, y: 0 },
    shake: { amplitude: 0, scale: 1, durationMs: 0 },
    praiseFontSize: 0,
    reducedMotion: false,
  };
}

function renderShard(key: string, reducedMotion = false, flight?: { dx: number; dy: number; liftY: number; rotationDeg: number }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ClearBurstLayer } = require('../effects/ClearBurstLayer') as typeof import('../effects/ClearBurstLayer');
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <ClearBurstLayer
        presentations={[{ id: key, presentation: { ...presentationWith(key), reducedMotion, shards: [{ ...SHARD, duration: flight ? 420 : SHARD.duration, flight }] } }] as never}
      />,
    );
  });
  return renderer;
}

describe('pooled burst particle motion', () => {
  beforeEach(() => {
    mockSharedValues.length = 0;
  });

  it('is visible immediately and delays only its fade', () => {
    renderShard('visible');
    const opacityLike = mockSharedValues.filter(
      (shared) =>
        shared.__history.some((entry) => entry === 1) &&
        shared.__history.some(
          (entry) =>
            delayedContainsTimingTo(entry, 0) &&
            (entry as DelayMarker).delayMs >= SHARD.delay,
        ),
    );
    expect(opacityLike.length).toBeGreaterThan(0);
    expect(
      mockSharedValues.some((shared) =>
        shared.__history.some((entry) => delayedContainsTimingTo(entry, 1)),
      ),
    ).toBe(false);
  });

  it('flashes to the crack color and returns to the block color', () => {
    renderShard('flash');
    expect(
      mockSharedValues.some((shared) =>
        shared.__history.some((entry) => {
          if (!isDelay(entry) || entry.delayMs !== SHARD.delay) return false;
          if (!isSequence(entry.target)) return false;
          const [flash, back] = entry.target.steps;
          return (
            isTiming(flash) &&
            flash.to === SHARD.flashColor &&
            isTiming(back) &&
            back.to === SHARD.color
          );
        }),
      ),
    ).toBe(true);
  });

  it('shrinks locally without any translation or spin', () => {
    const renderer = renderShard('dissolve');
    expect(mockSharedValues.some((shared) =>
      shared.__history.some((entry) => delayedContainsTimingTo(entry, 0.76)),
    )).toBe(true);
    for (const node of renderer.root.findAllByType('animated-view' as never)) {
      expect(node.props.style.transform.slice(0, 3))
        .toEqual([{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }]);
    }
    act(() => renderer.unmount());
  });

  it('only fades the cover under reduced motion', () => {
    const renderer = renderShard('reduced', true);
    const histories = mockSharedValues.flatMap((shared) => shared.__history);
    expect(histories.filter(isTiming).map((timing) => timing.to)).toEqual([0]);
    expect(histories.filter(isDelay)).toEqual([]);
    act(() => renderer.unmount());
  });

  it('moves Adventure fragments through an upward kick and a fall before fading', () => {
    const flight = { dx: 18, dy: 36, liftY: -9, rotationDeg: 80 };
    const renderer = renderShard('shatter', false, flight);
    for (const target of [flight.dx, flight.dy, flight.liftY, flight.rotationDeg]) {
      expect(mockSharedValues.some(shared => shared.__history.some(entry => delayedContainsTimingTo(entry, target))))
        .toBe(true);
    }
    expect(mockSharedValues.some(shared => shared.__history.some(entry =>
      isDelay(entry) && entry.delayMs === SHARD.delay + 420 - 120 && delayedContainsTimingTo(entry, 0),
    ))).toBe(true);
    act(() => renderer.unmount());
  });

  it('does not replay an active clear when its parent renders again', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClearBurstLayer } = require('../effects/ClearBurstLayer') as typeof import('../effects/ClearBurstLayer');
    const renderer = renderShard('once');
    const historyCount = () => mockSharedValues.reduce((sum, shared) => sum + shared.__history.length, 0);
    const before = historyCount();
    act(() => renderer.update(
      <ClearBurstLayer presentations={[{ id: 'once', presentation: presentationWith('once') }] as never} />,
    ));
    expect(historyCount()).toBe(before);
    act(() => renderer.unmount());
  });

});
