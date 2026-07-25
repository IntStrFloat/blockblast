import React from 'react';
import { act, create } from 'react-test-renderer';

import { useSettings } from '@/features/settings';

import { ATMOSPHERE } from '../animation/atmosphere';
import { AtmosphereToast } from '../components/AtmosphereToast';
import { useGameStore } from '../store';

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  const transition = {
    duration() {
      return this;
    },
  };

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('animated-view', props, children),
    },
    FadeIn: transition,
    FadeOut: transition,
  };
});

jest.mock('@/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');

  return {
    AppText: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(Text, props, children),
    radii: { button: 16 },
  };
});

describe('AtmosphereToast', () => {
  let renderer: ReturnType<typeof create> | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    act(() => {
      useSettings.setState({ lang: 'ru', praiseTone: 'classic' });
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 0 },
        recordCelebration: null,
      }));
      renderer = create(<AtmosphereToast />);
    });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    jest.useRealTimers();
  });

  function toastCount() {
    return renderer!.root.findAllByProps({ testID: 'atmosphere-toast' }).length;
  }

  it('dismisses after the deadline even when the score changes inside the same phase', () => {
    act(() => {
      useGameStore.setState((state) => ({ game: { ...state.game, score: 500 } }));
    });
    expect(toastCount()).toBeGreaterThan(0);

    act(() => {
      useGameStore.setState((state) => ({ game: { ...state.game, score: 520 } }));
      jest.advanceTimersByTime(ATMOSPHERE.toastDurationMs - 1);
    });
    expect(toastCount()).toBeGreaterThan(0);

    act(() => jest.advanceTimersByTime(1));
    expect(toastCount()).toBe(0);
  });
});
