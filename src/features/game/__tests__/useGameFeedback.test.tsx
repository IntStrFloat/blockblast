import React from 'react';
import { act, create } from 'react-test-renderer';

import type { PlacementEvent } from '@/core/engine';
import { useSettings } from '@/features/settings';

import { NewRecordCelebration } from '../effects/NewRecordCelebration';
import { useGameStore } from '../store';
import { useGameFeedback } from '../sound/useGameFeedback';

jest.mock('../sound/sounds', () => ({
  initSounds: jest.fn(),
  playSound: jest.fn(),
}));
const { playSound: mockPlaySound } = jest.requireMock('../sound/sounds') as {
  playSound: jest.Mock;
};

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: {
    Warning: 'Warning',
    Success: 'Success',
  },
  ImpactFeedbackStyle: {
    Heavy: 'Heavy',
    Medium: 'Medium',
    Light: 'Light',
  },
}));
const {
  notificationAsync: mockNotificationAsync,
  impactAsync: mockImpactAsync,
} = jest.requireMock('expo-haptics') as {
  notificationAsync: jest.Mock;
  impactAsync: jest.Mock;
};

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  class MockKeyframe {
    duration() {
      return this;
    }

    delay() {
      return this;
    }
  }

  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: React.ComponentType<any>) => Component,
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('animated-view', props, children),
    },
    Keyframe: MockKeyframe,
  };
});

jest.mock('../animation/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('@/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');

  return {
    AppText: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(Text, props, children),
    BLOCK_THEMES: [{ cellColors: ['#F5C451', '#FFE27A', '#FFF6BA', '#FFFFFF'] }],
    colors: {
      accent: '#FFC93C',
      textPrimary: '#FFFFFF',
    },
    radii: {
      button: 16,
    },
  };
});

function placementEvent(overrides: Partial<PlacementEvent> = {}): PlacementEvent {
  return {
    placed: [[0, 0]],
    colorId: 1,
    clearedRows: [],
    clearedCols: [],
    clearedCells: [],
    clearedColors: [],
    scoreDelta: 1,
    score: 1,
    combo: 0,
    praise: 'none',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
    ...overrides,
  };
}

function recordCelebration(score: number, previousBest: number) {
  return { score, previousBest };
}

function Probe() {
  useGameFeedback();
  return null;
}

function IntegratedProbe() {
  useGameFeedback();
  return React.createElement(NewRecordCelebration);
}

function mountProbe() {
  let renderer: ReturnType<typeof create> | null = null;
  act(() => {
    renderer = create(<Probe />);
  });
  return renderer!;
}

function mountIntegratedProbe() {
  let renderer: ReturnType<typeof create> | null = null;
  act(() => {
    renderer = create(React.createElement(IntegratedProbe));
  });
  return renderer!;
}

function activeCelebrationCount(renderer: ReturnType<typeof create>) {
  return new Set(
    renderer.root
      .findAll((node) => node.props.testID === 'new-record-celebration')
      .map((node) => node.props.testID),
  ).size;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  act(() => {
    useSettings.setState({ sound: true, haptics: true });
    useGameStore.getState().newGame({ seed: 7 });
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useGameFeedback', () => {
  it('does not replay a handled placement event when settings toggle', () => {
    const renderer = mountProbe();

    act(() => {
      useGameStore.setState({ lastEvent: placementEvent() });
    });

    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);

    act(() => {
      useSettings.setState({ sound: false });
    });
    act(() => {
      useSettings.setState({ haptics: false });
    });
    act(() => {
      useSettings.setState({ sound: true, haptics: true });
    });

    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });
  });

  it('does not replay a handled game-over cue when settings toggle', () => {
    const renderer = mountProbe();

    act(() => {
      useGameStore.setState({
        lastEvent: placementEvent({
          gameOver: true,
          clearedRows: [0, 1],
          onFire: true,
        }),
      });
    });

    expect(mockPlaySound).toHaveBeenCalledWith('gameover');
    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockNotificationAsync).toHaveBeenCalledTimes(1);

    act(() => {
      useSettings.setState({ sound: false });
      useSettings.setState({ haptics: false });
    });
    act(() => {
      useSettings.setState({ sound: true, haptics: true });
    });

    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockNotificationAsync).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });
  });

  it('consumes a record event immediately when sound is off at event time', () => {
    const renderer = mountProbe();

    act(() => {
      useSettings.setState({ sound: false });
    });
    act(() => {
      useGameStore.setState({
        recordCelebration: recordCelebration(11, 10),
        recordCelebrated: false,
      });
    });

    expect(useGameStore.getState().recordCelebrated).toBe(true);

    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(mockPlaySound).not.toHaveBeenCalled();

    act(() => {
      useSettings.setState({ sound: true });
      jest.advanceTimersByTime(1000);
    });

    expect(mockPlaySound).not.toHaveBeenCalled();

    act(() => {
      renderer.unmount();
    });
  });

  it('clears a pending record timer when sound turns off and does not replay after re-enable', () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    const renderer = mountProbe();

    act(() => {
      useGameStore.setState({
        recordCelebration: recordCelebration(12, 10),
        recordCelebrated: false,
      });
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    act(() => {
      useSettings.setState({ sound: false });
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();

    act(() => {
      useSettings.setState({ sound: true });
      jest.advanceTimersByTime(1000);
    });

    expect(mockPlaySound).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();

    act(() => {
      renderer.unmount();
    });
  });

  it('clears a pending record timer on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    const renderer = mountProbe();

    act(() => {
      useGameStore.setState({
        recordCelebration: recordCelebration(13, 10),
        recordCelebrated: false,
      });
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    act(() => {
      renderer.unmount();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockPlaySound).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('plays the record sound once while the celebration renders once even across rerenders', () => {
    const renderer = mountIntegratedProbe();

    act(() => {
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 77 },
        recordCelebration: recordCelebration(77, 50),
        recordCelebrated: false,
      }));
    });

    expect(useGameStore.getState().recordCelebrated).toBe(true);
    expect(activeCelebrationCount(renderer)).toBe(1);
    expect(renderer.root.findByProps({ testID: 'new-record-score' }).props.children).toBe(77);

    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(mockPlaySound).toHaveBeenCalledWith('record');
    expect(mockPlaySound.mock.calls.filter(([name]) => name === 'record')).toHaveLength(1);

    act(() => {
      renderer.update(React.createElement(IntegratedProbe));
      jest.advanceTimersByTime(1000);
    });

    expect(mockPlaySound.mock.calls.filter(([name]) => name === 'record')).toHaveLength(1);
    expect(activeCelebrationCount(renderer)).toBeLessThanOrEqual(1);

    act(() => {
      renderer.unmount();
    });
  });

  it('still shows the record celebration once when sound is off without later replaying audio', () => {
    const renderer = mountIntegratedProbe();

    act(() => {
      useSettings.setState({ sound: false });
      useGameStore.setState((state) => ({
        game: { ...state.game, score: 81 },
        recordCelebration: recordCelebration(81, 50),
        recordCelebrated: false,
      }));
    });

    expect(useGameStore.getState().recordCelebrated).toBe(true);
    expect(activeCelebrationCount(renderer)).toBe(1);

    act(() => {
      jest.advanceTimersByTime(1300);
    });
    expect(activeCelebrationCount(renderer)).toBe(0);
    expect(mockPlaySound.mock.calls.filter(([name]) => name === 'record')).toHaveLength(0);

    act(() => {
      useSettings.setState({ sound: true });
      renderer.update(React.createElement(IntegratedProbe));
      jest.advanceTimersByTime(1000);
    });
    expect(mockPlaySound.mock.calls.filter(([name]) => name === 'record')).toHaveLength(0);

    act(() => {
      renderer.unmount();
    });
  });
});
