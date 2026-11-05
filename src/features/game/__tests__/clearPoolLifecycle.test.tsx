import React from 'react';
import { AppState } from 'react-native';
import { act, create } from 'react-test-renderer';

import type { PlacementEvent } from '@/core/engine';
import { buildClearPresentation, type ClearPresentationInstance } from '../animation/clearPresentation';
import { BURST_MOTION } from '../animation/motion';
import { ClearBurstLayer } from '../effects/ClearBurstLayer';
import { ClearDebrisLayer } from '../effects/ClearDebrisLayer';
import { ClearSparkLayer } from '../effects/ClearSparkLayer';
import { ClearChoreographyLayer } from '../effects/ClearChoreographyLayer';

interface MockValue {
  value: unknown;
  animation: boolean;
}
const mockValues: MockValue[] = [];
const mockStyles: (() => { opacity?: unknown })[] = [];
const mockFrames: {
  callback: (frame: { timeSincePreviousFrame: number }) => void;
  active: boolean;
}[] = [];
const mockCancel = jest.fn((value: MockValue) => { value.animation = false; });
const mockStyleRenders = jest.fn();
let mockDeferScheduledWork = false;
const mockScheduledWork: (() => void)[] = [];

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => {
    if (mockDeferScheduledWork) {
      mockScheduledWork.push(() => callback(...args));
      return;
    }
    callback(...args);
  },
}));

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const animation = () => ({ animated: true });
  return {
    __esModule: true,
    default: { View: (props: object) => React.createElement('animated-view', props) },
    Easing: { quad: 'quad', in: (value: unknown) => value, out: (value: unknown) => value, bezier: () => (value: number) => value },
    cancelAnimation: (value: MockValue) => mockCancel(value),
    useSharedValue: (initial: unknown) => {
      const ref = React.useRef(null);
      if (!ref.current) {
        let current = initial;
        const shared: MockValue = {
          animation: false,
          get value() { return current; },
          set value(next: unknown) {
            current = next;
            shared.animation = !!next && typeof next === 'object' && 'animated' in next;
          },
        };
        ref.current = shared;
        mockValues.push(shared);
      }
      return ref.current;
    },
    useAnimatedStyle: (factory: () => { opacity?: unknown }) => {
      mockStyleRenders();
      const registered = React.useRef(false);
      if (!registered.current) { mockStyles.push(factory); registered.current = true; }
      return factory();
    },
    useFrameCallback: (
      callback: (frame: { timeSincePreviousFrame: number }) => void,
      autostart = true,
    ) => {
      const controller = React.useRef(null);
      if (!controller.current) {
        const entry = { callback, active: autostart };
        mockFrames.push(entry);
        controller.current = {
          isActive: autostart,
          setActive(active: boolean) {
            entry.active = active;
            controller.current.isActive = active;
          },
        };
      }
      return controller.current;
    },
    withTiming: animation,
    withDelay: animation,
    withSequence: animation,
  };
});

const event: PlacementEvent = {
  placed: [[3, 3]], colorId: 1, clearedRows: [3], clearedCols: [],
  clearedCells: Array.from({ length: 8 }, (_, col) => [3, col] as const),
  clearedColors: Array.from({ length: 8 }, () => 1), scoreDelta: 100, score: 100,
  combo: 1, praise: 'good', onFire: false, boardCleared: false,
  newTray: false, gameOver: false,
};
function presentation(id: string, fillPool = false): ClearPresentationInstance {
  const value = buildClearPresentation(event, { boardSize: 360, cell: 43.25, gap: 2 }, ['#45AAFF'], false);
  if (fillPool) {
    // Fill every slot so the next clear replaces every owner after the cursor wraps.
    value.shards = Array.from({ length: BURST_MOTION.shardPoolSize }, () => value.shards[0]!);
    value.debris = Array.from({ length: BURST_MOTION.debrisCap * 2 }, () => value.debris[0]!);
    value.sparks = Array.from({ length: BURST_MOTION.sparkCap * 2 }, () => value.sparks[0]!);
    value.sequence.beams = Array.from({ length: 8 }, () => value.sequence.beams[0]!);
    value.sequence.motes = Array.from({ length: 16 }, () => value.sequence.motes[0]!);
  }
  return { id, presentation: value };
}
function tick() {
  for (let i = 0; i < 4; i += 1) {
    mockFrames.forEach((entry) => {
      if (entry.active) entry.callback({ timeSincePreviousFrame: 16 });
    });
  }
}
function activeFrameCallbacks() {
  return mockFrames.filter((entry) => entry.active).length;
}
function activeWork() {
  return mockValues.filter((value) => value.animation).length +
    mockStyles.filter((style) => typeof style().opacity === 'number' && (style().opacity as number) > 0).length;
}

const layers = [ClearBurstLayer, ClearDebrisLayer, ClearSparkLayer, ClearChoreographyLayer];

it('keeps every pooled spark frame callback inactive while idle and after natural completion', () => {
  mockValues.length = 0; mockStyles.length = 0; mockFrames.length = 0; mockCancel.mockClear();
  mockDeferScheduledWork = false; mockScheduledWork.length = 0;
  let renderer!: ReturnType<typeof create>;
  act(() => { renderer = create(<ClearSparkLayer presentations={[]} />); });
  expect(activeFrameCallbacks()).toBe(0);

  act(() => renderer.update(<ClearSparkLayer presentations={[presentation('spark')]} />));
  expect(activeFrameCallbacks()).toBeGreaterThan(0);
  act(() => {
    for (let i = 0; i < 100; i += 1) tick();
  });
  expect(activeFrameCallbacks()).toBe(0);
  act(() => renderer.unmount());
});

it('does not let a delayed natural stop cancel a reused slot', () => {
  mockValues.length = 0; mockStyles.length = 0; mockFrames.length = 0; mockCancel.mockClear();
  mockDeferScheduledWork = true; mockScheduledWork.length = 0;
  let renderer!: ReturnType<typeof create>;
  act(() => { renderer = create(<ClearSparkLayer presentations={[presentation('old', true)]} />); });
  act(() => {
    for (let i = 0; i < 100; i += 1) tick();
  });
  expect(mockScheduledWork).toHaveLength(BURST_MOTION.sparkCap * 2);

  act(() => renderer.update(<ClearSparkLayer presentations={[presentation('new', true)]} />));
  expect(activeFrameCallbacks()).toBe(BURST_MOTION.sparkCap * 2);
  act(() => mockScheduledWork.splice(0).forEach((finish) => finish()));
  expect(activeFrameCallbacks()).toBe(BURST_MOTION.sparkCap * 2);

  mockDeferScheduledWork = false;
  act(() => {
    for (let i = 0; i < 100; i += 1) tick();
  });
  expect(activeFrameCallbacks()).toBe(0);
  act(() => renderer.unmount());
});

it('does not replay a cancelled presentation after backgrounding', () => {
  mockValues.length = 0; mockStyles.length = 0; mockFrames.length = 0; mockCancel.mockClear();
  let onAppStateChange: ((state: string) => void) | undefined;
  const addEventListenerMock = AppState.addEventListener as jest.Mock;
  const previousImplementation = addEventListenerMock.getMockImplementation();
  addEventListenerMock.mockImplementation((_: string, listener: (state: string) => void) => {
    onAppStateChange = listener as (state: string) => void;
    return { remove: jest.fn() };
  });
  const oldPresentation = presentation('old');
  const newPresentation = presentation('new');
  let renderer!: ReturnType<typeof create>;

  act(() => { renderer = create(<ClearSparkLayer presentations={[oldPresentation]} />); });
  expect(activeFrameCallbacks()).toBe(oldPresentation.presentation.sparks.length);
  act(() => onAppStateChange?.('background'));
  expect(activeFrameCallbacks()).toBe(0);

  act(() => renderer.update(<ClearSparkLayer presentations={[oldPresentation]} />));
  expect(activeFrameCallbacks()).toBe(0);
  act(() => renderer.update(
    <ClearSparkLayer presentations={[oldPresentation, newPresentation]} />,
  ));
  expect(activeFrameCallbacks()).toBe(newPresentation.presentation.sparks.length);

  act(() => {
    for (let i = 0; i < 100; i += 1) tick();
  });
  expect(activeFrameCallbacks()).toBe(0);
  act(() => renderer.unmount());
  addEventListenerMock.mockImplementation(previousImplementation ?? (() => ({ remove: jest.fn() })));
});

it('stops Adventure flight transforms when their presentation is removed', () => {
  mockValues.length = 0; mockStyles.length = 0; mockFrames.length = 0; mockCancel.mockClear();
  const data = presentation('adventure');
  data.presentation.shards = data.presentation.shards.map(shard => ({
    ...shard, duration: 420,
    flight: { dx: 12, dy: 28, liftY: -8, rotationDeg: 70 },
  }));
  let renderer!: ReturnType<typeof create>;
  act(() => { renderer = create(<ClearBurstLayer presentations={[data]} />); });
  expect(activeWork()).toBeGreaterThan(0);
  act(() => renderer.update(<ClearBurstLayer presentations={[]} />));
  expect(activeWork()).toBe(0);
  act(() => renderer.unmount());
});

describe.each(layers)('%p pool lifecycle', (Layer) => {
  beforeEach(() => {
    mockValues.length = 0; mockStyles.length = 0; mockFrames.length = 0; mockCancel.mockClear();
    mockStyleRenders.mockClear();
    mockDeferScheduledWork = false; mockScheduledWork.length = 0;
  });

  it('updates a clear through its existing handles without rendering every pool slot again', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<Layer presentations={[]} />); });
    const initialStyleRenders = mockStyleRenders.mock.calls.length;
    expect(initialStyleRenders).toBeGreaterThan(0);

    const next = presentation('next');
    act(() => renderer.update(<Layer presentations={[next]} />));
    tick();
    expect(activeWork()).toBeGreaterThan(0);
    expect(mockStyleRenders).toHaveBeenCalledTimes(initialStyleRenders);

    act(() => renderer.update(<Layer presentations={[]} />));
    expect(activeWork()).toBe(0);
    expect(mockStyleRenders).toHaveBeenCalledTimes(initialStyleRenders);
    act(() => renderer.unmount());
  });

  it('keeps per-frame motion updates eligible for the synchronous UI-prop path', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<Layer presentations={[presentation('motion')]} />); });
    const motionStyles = mockStyles.filter((read) => 'opacity' in read());
    expect(motionStyles.length).toBeGreaterThan(0);
    for (const read of motionStyles) {
      // The native fast path rejects an entire update if any property requires
      // layout. Keep these records limited to opacity and transform.
      expect(Object.keys(read()).every((key) => key === 'opacity' || key === 'transform')).toBe(true);
    }
    act(() => renderer.unmount());
  });

  it('stops and hides an evicted clear before its animation finishes', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<Layer presentations={[presentation('old')]} />); });
    tick();
    expect(activeWork()).toBeGreaterThan(0);
    act(() => renderer.update(<Layer presentations={[]} />));
    tick();
    expect(activeWork()).toBe(0);
    act(() => renderer.unmount());
  });

  it('keeps reused slots alive when their previous owner is removed', () => {
    let renderer!: ReturnType<typeof create>;
    const old = presentation('old', true);
    const next = presentation('new', true);
    act(() => { renderer = create(<Layer presentations={[old]} />); });
    act(() => renderer.update(<Layer presentations={[old, next]} />));
    tick();
    const cancelsBefore = mockCancel.mock.calls.length;
    const workBefore = activeWork();
    expect(workBefore).toBeGreaterThan(0);
    act(() => renderer.update(<Layer presentations={[next]} />));
    expect(mockCancel).toHaveBeenCalledTimes(cancelsBefore);
    expect(activeWork()).toBe(workBefore);
    act(() => renderer.unmount());
  });

  it('cancels outstanding work when the layer unmounts', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<Layer presentations={[presentation('old')]} />); });
    tick();
    expect(activeWork()).toBeGreaterThan(0);
    act(() => renderer.unmount());
    tick();
    expect(activeWork()).toBe(0);
  });
});
