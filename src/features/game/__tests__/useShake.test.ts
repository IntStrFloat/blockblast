import React from 'react';
import { act, create } from 'react-test-renderer';

import { SPECTACLE_MOTION } from '../animation/motion';
import { composeShakePresentation, useShake } from '../effects/useShake';

const mockCancelAnimation = jest.fn();
const mockWithDelay = jest.fn((delay: number, animation: unknown) => ({
  kind: 'delay',
  delay,
  animation,
}));
const mockWithSequence = jest.fn((...steps: unknown[]) => ({
  kind: 'sequence',
  steps,
}));
const mockWithTiming = jest.fn((toValue: number, config: unknown) => ({
  kind: 'timing',
  toValue,
  config,
}));
const sharedValues: { value: unknown }[] = [];

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  cancelAnimation: (value: { value: unknown }) => mockCancelAnimation(value),
  useAnimatedStyle: (factory: () => unknown) => factory(),
  useSharedValue: (initial: unknown) => {
    const value = { value: initial };
    sharedValues.push(value);
    return value;
  },
  withDelay: (delay: number, animation: unknown) => mockWithDelay(delay, animation),
  withSequence: (...steps: unknown[]) => mockWithSequence(...steps),
  withTiming: (toValue: number, config: unknown) => mockWithTiming(toValue, config),
}));

function lastAnimation(index: number) {
  return sharedValues[index]?.value as
    | { kind: 'delay'; delay: number; animation: { kind: 'sequence'; steps: { toValue: number }[] } }
    | { kind: 'timing'; toValue: number };
}

function delayedAnimation(index: number) {
  const animation = lastAnimation(index);
  expect(animation).toMatchObject({ kind: 'delay' });
  return animation as {
    kind: 'delay';
    delay: number;
    animation: { kind: 'sequence'; steps: { toValue: number }[] };
  };
}

function HookHarness({
  capture,
}: {
  capture: (value: ReturnType<typeof useShake>) => void;
}) {
  const value = useShake();
  capture(value);
  return null;
}

describe('composeShakePresentation', () => {
  it('picks the strongest clear/combo shake per axis without summing them', () => {
    expect(
      composeShakePresentation(
        { amplitude: 3, scale: 1, durationMs: 165 },
        { intensity: 0.5, lineStrength: 0.5, boardClearStrength: 0, shakeAmplitude: 6, shakeDurationMs: 120, scale: 1.12, reducedMotion: false },
      ),
    ).toEqual({
      amplitude: 6,
      scale: 1.12,
      durationMs: 165,
    });
  });

  it('returns a neutral shake when both sources are inactive', () => {
    expect(
      composeShakePresentation(
        { amplitude: 0, scale: 1, durationMs: 0 },
        { intensity: 0.25, lineStrength: 0.4, boardClearStrength: 0, shakeAmplitude: 0, shakeDurationMs: 0, scale: 1, reducedMotion: false },
      ),
    ).toEqual({
      amplitude: 0,
      scale: 1,
      durationMs: 0,
    });
  });
});

describe('useShake', () => {
  beforeEach(() => {
    sharedValues.length = 0;
    mockCancelAnimation.mockClear();
    mockWithDelay.mockClear();
    mockWithSequence.mockClear();
    mockWithTiming.mockClear();
  });

  it('cancels prior animations and restarts from the stronger rapid event', () => {
    let hook: ReturnType<typeof useShake> | null = null;

    act(() => {
      create(
        React.createElement(HookHarness, {
          capture: (value) => {
            hook = value;
          },
        }),
      );
    });

    act(() => {
      hook!.triggerShake({
        clear: { amplitude: 3, scale: 1, durationMs: 165 },
        combo: { intensity: 0.35, lineStrength: 0.25, boardClearStrength: 0, shakeAmplitude: 0, shakeDurationMs: 0, scale: 1, reducedMotion: false },
      });
      hook!.triggerShake({
        clear: { amplitude: 1, scale: 1, durationMs: 105 },
        combo: { intensity: 0.7, lineStrength: 0.5, boardClearStrength: 1, shakeAmplitude: 6, shakeDurationMs: 165, scale: 1.12, reducedMotion: false },
      });
    });

    expect(mockCancelAnimation).toHaveBeenCalledTimes(6);
    expect(mockWithDelay).toHaveBeenCalled();
    expect(lastAnimation(0)).toMatchObject({ kind: 'delay', delay: SPECTACLE_MOTION.debrisStartMs });
    expect(lastAnimation(2)).toMatchObject({ kind: 'delay', delay: SPECTACLE_MOTION.debrisStartMs });
    expect(delayedAnimation(0).animation.steps.at(-1)?.toValue).toBe(0);
    expect(delayedAnimation(2).animation.steps.at(-1)?.toValue).toBe(1);
  });

  it('returns translate and scale to neutral when a follow-up event has no shake', () => {
    let hook: ReturnType<typeof useShake> | null = null;

    act(() => {
      create(
        React.createElement(HookHarness, {
          capture: (value) => {
            hook = value;
          },
        }),
      );
    });

    act(() => {
      hook!.triggerShake({
        clear: { amplitude: 4, scale: 1.01, durationMs: 175 },
        combo: { intensity: 0.7, lineStrength: 0.5, boardClearStrength: 0, shakeAmplitude: 4, shakeDurationMs: 165, scale: 1.08, reducedMotion: false },
      });
      hook!.triggerShake({
        clear: null,
        combo: { intensity: 0.2, lineStrength: 0.2, boardClearStrength: 0, shakeAmplitude: 0, shakeDurationMs: 0, scale: 1, reducedMotion: false },
      });
    });

    expect(mockCancelAnimation).toHaveBeenCalledTimes(6);
    expect(lastAnimation(0)).toMatchObject({ kind: 'timing', toValue: 0 });
    expect(lastAnimation(1)).toMatchObject({ kind: 'timing', toValue: 0 });
    expect(lastAnimation(2)).toMatchObject({ kind: 'timing', toValue: 1 });
  });
});
