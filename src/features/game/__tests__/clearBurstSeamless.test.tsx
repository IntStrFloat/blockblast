/**
 * Контракт «бесшовного» разрушения: доска пустеет мгновенно в момент клира,
 * поэтому осколки пула обязаны (а) полностью тайлить каждую очищенную ячейку
 * и (б) быть видимыми сразу в позе куска ячейки — задержка распределяет
 * только раскол, разлёт и затухание, но не появление. Иначе виден «разрез»:
 * блоки исчезли, а анимация разрушения появляется с лагом.
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
    Easing: {
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

/** Внутри отложенной анимации есть withTiming к указанному значению? */
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
    placed: [
      [3, 3],
      [3, 4],
      [4, 3],
      [4, 4],
    ],
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

describe('burst coverage of cleared cells', () => {
  it('осколки полностью тайлят каждую ячейку двухлинейного клира', () => {
    const event = twoRowEvent();
    const presentation = buildClearPresentation(event, GEOM, CELL_COLORS, false);

    const step = GEOM.cell + GEOM.gap;
    for (const [row, col] of event.clearedCells) {
      const x = col * step;
      const y = row * step;
      const pieces = presentation.shards.filter(
        (shard) => shard.x >= x && shard.x < x + GEOM.cell && shard.y >= y && shard.y < y + GEOM.cell,
      );
      expect(pieces.length).toBeGreaterThan(0);
      const area = pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0);
      expect(area).toBeCloseTo(GEOM.cell * GEOM.cell);
    }
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
  jumpY: -14,
  driftX: 6,
  dx: 18,
  dy: 85, // boardSize 94 − y 24 + 1.5 клетки
  rotate: 46,
  delay: 30,
  fallDuration: 360,
};

function presentationWith(shard: typeof SHARD, key: string) {
  return {
    key,
    debris: [],
    shards: [shard],
    centroid: { x: 0, y: 0 },
    shake: { amplitude: 0, scale: 1, durationMs: 0 },
    praiseFontSize: 0,
    reducedMotion: false,
  };
}

describe('burst particle visibility', () => {
  beforeEach(() => {
    mockSharedValues.length = 0;
  });

  it('осколок виден сразу в позе куска ячейки; задержка относится только к затуханию', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClearBurstLayer } = require('../effects/ClearBurstLayer') as typeof import('../effects/ClearBurstLayer');

    act(() => {
      create(
        <ClearBurstLayer
          presentations={[{ id: 'instance-1', presentation: presentationWith(SHARD, 'clear-burst-test') }] as never}
        />,
      );
    });

    // Opacity-контракт: одно shared value получает мгновенную единицу
    // (осколок непрозрачен в кадре клира) и отложенное затухание к нулю
    // не раньше, чем истечёт задержка раскола самой ячейки.
    const opacityLike = mockSharedValues.filter(
      (shared) =>
        shared.__history.some((entry) => entry === 1) &&
        shared.__history.some(
          (entry) => delayedContainsTimingTo(entry, 0) && (entry as DelayMarker).delayMs >= SHARD.delay,
        ),
    );
    expect(opacityLike.length).toBeGreaterThan(0);

    // И никакого отложенного «фейд-ина» к 1: видимость не анимируется вверх.
    const delayedFadeIn = mockSharedValues.some((shared) =>
      shared.__history.some((entry) => delayedContainsTimingTo(entry, 1)),
    );
    expect(delayedFadeIn).toBe(false);
  });

  it('вспышка-крак: цвет вспыхивает светлым в момент раскола и гаснет к цвету блока', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClearBurstLayer } = require('../effects/ClearBurstLayer') as typeof import('../effects/ClearBurstLayer');

    act(() => {
      create(
        <ClearBurstLayer
          presentations={[{ id: 'instance-flash', presentation: presentationWith(SHARD, 'clear-burst-flash') }] as never}
        />,
      );
    });

    const flashLike = mockSharedValues.filter((shared) =>
      shared.__history.some((entry) => {
        if (!isDelay(entry) || entry.delayMs !== SHARD.delay) return false;
        if (!isSequence(entry.target)) return false;
        const [flash, back] = entry.target.steps;
        return (
          isTiming(flash) && flash.to === SHARD.flashColor &&
          isTiming(back) && back.to === SHARD.color
        );
      }),
    );
    expect(flashLike.length).toBeGreaterThan(0);
  });

  it('вертикаль: подскок вверх, затем падение за нижний край доски', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClearBurstLayer } = require('../effects/ClearBurstLayer') as typeof import('../effects/ClearBurstLayer');

    act(() => {
      create(
        <ClearBurstLayer
          presentations={[{ id: 'instance-2', presentation: presentationWith(SHARD, 'clear-burst-gravity-test') }] as never}
        />,
      );
    });

    // Ищем shared value вертикали: отложенная последовательность
    // «вверх (jumpY), затем вниз за доску (dy)».
    const verticalLike = mockSharedValues.filter((shared) =>
      shared.__history.some((entry) => {
        if (!isDelay(entry) || entry.delayMs !== SHARD.delay) return false;
        if (!isSequence(entry.target)) return false;
        const [up, down] = entry.target.steps;
        return (
          isTiming(up) && up.to === SHARD.jumpY &&
          isTiming(down) && down.to === SHARD.dy
        );
      }),
    );
    expect(verticalLike.length).toBeGreaterThan(0);
  });
});
