import React from 'react';
import { act, create } from 'react-test-renderer';
import type { SharedValue } from 'react-native-reanimated';

import { trayRestingScale } from '../animation/motion';
import type { DragCtx } from '../drag/DragContext';
import type { PlacementHandoff } from '../drag/PlacementHandoff';
import { useDrag } from '../drag/useDrag';

const mockSequence = jest.fn((...values: number[]) => values.at(-1));
const mockReactions: {
  prepare: () => unknown;
  react: (value: unknown) => void;
}[] = [];
const mockLandingCompletions: ((finished: boolean) => void)[] = [];

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return Object.defineProperty(Object.create(actual), 'Platform', {
    value: { ...actual.Platform, OS: 'android' },
  });
});

jest.mock('react-native-reanimated', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  return {
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: unknown) => void,
    ) => {
      const holder = ReactModule.useRef({ prepare, react });
      holder.current.prepare = prepare;
      holder.current.react = react;
      ReactModule.useEffect(() => {
        const reaction = holder.current;
        mockReactions.push(reaction);
        return () => {
          mockReactions.splice(mockReactions.indexOf(reaction), 1);
        };
      }, []);
    },
    useSharedValue: <T,>(initial: T) =>
      ReactModule.useRef({ value: initial }).current,
    useAnimatedStyle: (read: () => { transform: unknown }) => ({
      get transform() {
        return read().transform;
      },
      get nativeStyle() {
        return read();
      },
    }),
    Easing: { out: (value: unknown) => value, cubic: (value: number) => value },
    withRepeat: (value: number) => value,
    withTiming: (
      value: number,
      config?: { duration?: number },
      callback?: (finished: boolean) => void,
    ) => {
      if (config?.duration === 140 && callback)
        mockLandingCompletions.push(callback);
      return value;
    },
    withSpring: (value: number) => value,
    withSequence: (...values: number[]) => mockSequence(...values),
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (
    callback: (...args: unknown[]) => unknown,
    ...args: unknown[]
  ) => callback(...args),
}));

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const gesture = {
        handlers: {} as Record<string, (...args: unknown[]) => void>,
        enabled() {
          return gesture;
        },
        onBegin(callback: (...args: unknown[]) => void) {
          gesture.handlers.begin = callback;
          return gesture;
        },
        onTouchesUp(callback: (...args: unknown[]) => void) {
          gesture.handlers.touchesUp = callback;
          return gesture;
        },
        onStart(callback: (...args: unknown[]) => void) {
          gesture.handlers.start = callback;
          return gesture;
        },
        onUpdate(callback: (...args: unknown[]) => void) {
          gesture.handlers.update = callback;
          return gesture;
        },
        onEnd(callback: (...args: unknown[]) => void) {
          gesture.handlers.end = callback;
          return gesture;
        },
        onFinalize(callback: (...args: unknown[]) => void) {
          gesture.handlers.finalize = callback;
          return gesture;
        },
      };
      return gesture;
    },
  },
}));

const shared = <T,>(value: T) => ({ value }) as SharedValue<T>;

function context(): DragCtx {
  return {
    geom: { boardSize: 358, cell: 43, gap: 2, pad: 0 },
    boardOrigin: shared({ x: 0, y: 0 }),
    measureBoard: jest.fn(),
    boardMirror: shared(new Array(64).fill(0)),
    boardRevision: shared(0),
    preview: shared(new Array(64).fill(0)),
    previewColor: shared(0),
    invalidPreview: shared(new Array(64).fill(0)),
    invalidReason: shared(0),
    clearPrelude: shared(0),
    dragActive: shared(0),
    dragOwner: shared(-1),
    cellColors: ['#FFFFFF'],
    boardBg: '#000000',
    cellEmpty: '#111111',
    onDrop: jest.fn(() => true),
    onTouch: jest.fn(),
    onGrab: jest.fn(),
    onReturn: jest.fn(),
    onInvalidDrop: jest.fn(),
  };
}

describe('mounted drag resting scale', () => {
  let ctx: DragCtx;
  let result: ReturnType<typeof useDrag>;

  function Piece({
    height = 5,
    slotHeight = 150,
    disabled = false,
  }: {
    height?: number;
    slotHeight?: number;
    disabled?: boolean;
  }) {
    result = useDrag({
      trayIndex: 2,
      cells: Array.from({ length: height }, (_, index) => [index, 0] as const),
      w: 1,
      h: height,
      colorId: 1,
      disabled,
      ctx,
      slotMeasure: shared({ x: 0, y: 400, width: 125, height: 112 }),
      measureForDrag: jest.fn(),
      committedOpacity: shared(1),
      restingScale: trayRestingScale(
        43,
        height * 43 + (height - 1) * 2,
        125,
        slotHeight,
      ),
    });
    return null;
  }

  function scale() {
    const style = result.animatedStyle as unknown as {
      transform: { scale?: number }[];
    };
    return style.transform.find((item) => item.scale != null)!.scale!;
  }

  function handlers() {
    return (
      result.gesture as unknown as {
        handlers: Record<string, (...args: unknown[]) => void>;
      }
    ).handlers;
  }

  beforeEach(() => {
    ctx = context();
    mockSequence.mockClear();
    mockLandingCompletions.length = 0;
    mockReactions.length = 0;
  });

  it('refreshes a stationary preview when another placement changes the board', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Piece height={1} />);
    });
    const gesture = handlers();
    act(() => {
      gesture.begin();
      gesture.start();
      gesture.update({ translationX: -41, translationY: -370 });
    });
    expect(ctx.preview.value[0] & 1).toBe(1);
    ctx.boardMirror.value = [1, ...new Array(63).fill(0)];
    ctx.boardRevision!.value += 1;
    act(() => {
      for (const reaction of mockReactions) reaction.react(reaction.prepare());
    });
    expect(ctx.invalidPreview.value[0]).toBe(2);
    expect(ctx.preview.value.every((mask) => mask === 0)).toBe(true);
    act(() => {
      gesture.end({}, true);
    });
    expect(ctx.onDrop).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('keeps a native landing visible through animation and engine commit, and excludes a second gesture', () => {
    const handoff: PlacementHandoff = {
      active: shared(0),
      owner: shared(-1),
      serial: shared(0),
      progress: shared(0),
      pending: { current: 0 },
      piece: shared<PlacementHandoff['piece']['value']>({
        cells: [],
        jewels: [],
        color: '#FFFFFF',
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: 0,
        width: 0,
        height: 0,
        scale: 1,
      }),
    };
    ctx.handoff = handoff;
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Piece height={1} />);
    });
    const gesture = handlers();
    act(() => {
      gesture.begin();
      gesture.start();
      gesture.update({ translationX: -41, translationY: -374.5 });
      gesture.end({}, true);
      gesture.finalize({}, true);
    });
    expect(handoff.active.value).toBe(1);
    expect(ctx.onDrop).not.toHaveBeenCalled();
    const landing = handoff.piece.value;
    expect(landing.fromX).toBeCloseTo(landing.toX);
    expect(landing.fromY).toBeCloseTo(17);
    act(() => {
      gesture.begin();
      gesture.start();
      gesture.update({ translationX: 300, translationY: -200 });
      gesture.end({}, true);
      gesture.finalize({}, true);
    });
    expect(handoff.piece.value).toBe(landing);
    expect(handoff.serial.value).toBe(1);
    act(() => {
      mockLandingCompletions[0](true);
    });
    expect(ctx.onDrop).toHaveBeenCalledTimes(1);
    expect(handoff.pending.current).toBe(1);
    expect(handoff.active.value).toBe(1);
    act(() => {
      tree.unmount();
    });
  });

  it('keeps Android drag updates eligible for the native transform path', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Piece />);
    });
    const style = result.animatedStyle as unknown as { nativeStyle: object };
    expect(Object.keys(style.nativeStyle)).toEqual(['opacity', 'transform']);
    act(() => {
      tree.unmount();
    });
  });

  it.each([false, true])(
    'pulses the line preview only for a clearing placement: %s',
    (clearsLine) => {
      if (clearsLine)
        for (let col = 1; col < 8; col++) ctx.boardMirror.value[col] = 1;
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(<Piece height={1} />);
      });
      const gesture = handlers();
      act(() => {
        gesture.begin();
        gesture.start();
        gesture.update({ translationX: -41, translationY: -374.5 });
        gesture.end({ velocityX: 0, velocityY: 0 }, true);
      });
      expect(ctx.onDrop).toHaveBeenCalledWith(2, 0, 0);
      expect(mockSequence).toHaveBeenCalledTimes(clearsLine ? 1 : 0);
      act(() => {
        tree.unmount();
      });
    },
  );

  it('fits a new tall piece and a smaller tray without requiring a drag', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Piece height={2} slotHeight={150} />);
    });
    expect(scale()).toBe(0.55);

    act(() => {
      tree.update(<Piece height={5} slotHeight={112} />);
    });
    expect(223 * scale()).toBeCloseTo(92);

    act(() => {
      tree.update(<Piece height={5} slotHeight={92} />);
    });
    expect(223 * scale()).toBeCloseTo(72);
  });

  it('keeps an active drag full-size and returns to the latest fit through its original callbacks', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Piece />);
    });
    const activeGesture = handlers();
    act(() => {
      activeGesture.begin();
      activeGesture.start();
    });
    expect(scale()).toBe(1);

    act(() => {
      tree.update(<Piece slotHeight={112} />);
    });
    expect(scale()).toBe(1);
    act(() => {
      activeGesture.end({ velocityX: 0, velocityY: 0 }, true);
    });
    expect(223 * scale()).toBeCloseTo(92);
    expect(ctx.onDrop).not.toHaveBeenCalled();
  });

  it('uses the latest fit after a valid drop without changing its one-shot commit', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Piece />);
    });
    const activeGesture = handlers();
    act(() => {
      activeGesture.begin();
      activeGesture.start();
    });
    act(() => {
      tree.update(<Piece slotHeight={112} />);
    });
    act(() => {
      activeGesture.update({ translationX: -41, translationY: -284.5 });
      activeGesture.touchesUp({ numberOfTouches: 0 });
      activeGesture.end({ velocityX: 0, velocityY: 0 }, true);
      activeGesture.finalize({}, true);
    });
    expect(ctx.onDrop).toHaveBeenCalledTimes(1);
    expect(ctx.onDrop).toHaveBeenCalledWith(2, 0, 0);
    expect(ctx.onInvalidDrop).not.toHaveBeenCalled();
    expect(ctx.onReturn).not.toHaveBeenCalled();
    expect(223 * scale()).toBeCloseTo(92);
  });

  it('returns a cancelled drag to the latest fit', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Piece />);
    });
    const activeGesture = handlers();
    act(() => {
      activeGesture.begin();
      activeGesture.start();
    });
    act(() => {
      tree.update(<Piece slotHeight={112} />);
    });
    act(() => {
      activeGesture.finalize({}, false);
    });
    expect(223 * scale()).toBeCloseTo(92);
    expect(ctx.onDrop).not.toHaveBeenCalled();
  });

  it('clears an interrupted owner when a piece becomes available again', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Piece disabled />);
    });
    const interruptedGesture = handlers();
    act(() => {
      interruptedGesture.begin();
      interruptedGesture.start();
      interruptedGesture.update({ translationX: 37, translationY: -91 });
    });
    expect(ctx.dragOwner.value).toBe(2);
    expect(ctx.dragActive.value).toBe(1);

    act(() => {
      tree.update(<Piece disabled={false} />);
    });

    expect(ctx.dragOwner.value).toBe(-1);
    expect(ctx.dragActive.value).toBe(0);
    expect(scale()).toBe(trayRestingScale(43, 223, 125, 150));
  });
  it('gives each unactivated touch a pickup and one return without tracking a drag', () => {
    act(() => {
      create(<Piece />);
    });
    const gesture = handlers();
    for (let index = 0; index < 3; index += 1) {
      act(() => {
        gesture.begin();
        gesture.touchesUp({ numberOfTouches: 0 });
        gesture.finalize({}, false);
      });
    }
    expect(ctx.onTouch).toHaveBeenCalledTimes(3);
    expect(ctx.onReturn).toHaveBeenCalledTimes(3);
    expect(ctx.onGrab).not.toHaveBeenCalled();
    expect(ctx.onInvalidDrop).not.toHaveBeenCalled();
    expect(ctx.onDrop).not.toHaveBeenCalled();
  });

  it('keeps pickup one-shot and returns an activated outside-board drag once', () => {
    act(() => {
      create(<Piece />);
    });
    const gesture = handlers();
    act(() => {
      gesture.begin();
      gesture.start();
      gesture.touchesUp({ numberOfTouches: 0 });
      gesture.end({ velocityX: 0, velocityY: 0 }, true);
      gesture.finalize({}, true);
    });
    expect(ctx.onTouch).toHaveBeenCalledTimes(1);
    expect(ctx.onGrab).toHaveBeenCalledTimes(1);
    expect(ctx.onInvalidDrop).toHaveBeenCalledTimes(1);
    expect(ctx.onInvalidDrop).toHaveBeenCalledWith('outside-board');
    expect(ctx.onReturn).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'does not sound a release or commit on cancellation (activated=%s)',
    (activated) => {
      act(() => {
        create(<Piece />);
      });
      const gesture = handlers();
      act(() => {
        gesture.begin();
        if (activated) {
          gesture.start();
          gesture.update({ translationX: -41, translationY: -284.5 });
          gesture.touchesUp({ numberOfTouches: 1 });
          gesture.end({ velocityX: 0, velocityY: 0 }, false);
        }
        gesture.finalize({}, false);
      });
      expect(ctx.onTouch).toHaveBeenCalledTimes(1);
      expect(ctx.onReturn).not.toHaveBeenCalled();
      expect(ctx.onInvalidDrop).not.toHaveBeenCalled();
      expect(ctx.onDrop).not.toHaveBeenCalled();
    },
  );

  it('returns a rejected engine placement once without an extra release cue', () => {
    ctx.onDrop = jest.fn(() => false);
    act(() => {
      create(<Piece />);
    });
    const gesture = handlers();
    act(() => {
      gesture.begin();
      gesture.start();
      gesture.update({ translationX: -41, translationY: -284.5 });
      gesture.touchesUp({ numberOfTouches: 0 });
      gesture.end({ velocityX: 0, velocityY: 0 }, true);
      gesture.finalize({}, true);
    });
    expect(ctx.onDrop).toHaveBeenCalledTimes(1);
    expect(ctx.onInvalidDrop).toHaveBeenCalledWith('occupied');
    expect(ctx.onInvalidDrop).toHaveBeenCalledTimes(1);
    expect(ctx.onReturn).not.toHaveBeenCalled();
  });
});
