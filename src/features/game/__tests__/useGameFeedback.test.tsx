import React from 'react';
import { act, create } from 'react-test-renderer';

import type { PlacementEvent } from '@/core/engine';
import { useSettings } from '@/features/settings';

import { NewRecordCelebration } from '../effects/NewRecordCelebration';
import { useGameStore } from '../store';
import { playPlacementFeedback } from '../sound/feedback';
import { useGameFeedback } from '../sound/useGameFeedback';

declare const __dirname: string;

jest.mock('../sound/sounds', () => ({
  initSounds: jest.fn(),
  playSound: jest.fn(),
  playPlacementFeedback: jest.fn(),
}));
const { playSound: mockPlaySound } = jest.requireMock('../sound/sounds') as {
  playSound: jest.Mock;
};

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  AndroidHaptics: {
    Confirm: 'confirm',
    Drag_Start: 'drag-start',
    Gesture_End: 'gesture-end',
    Reject: 'reject',
  },
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
  performAndroidHapticsAsync: mockPerformAndroidHapticsAsync,
} = jest.requireMock('expo-haptics') as {
  notificationAsync: jest.Mock;
  impactAsync: jest.Mock;
  performAndroidHapticsAsync: jest.Mock;
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
  it('dispatches the placement sound synchronously on the store update (no render gating)', () => {
    const renderer = mountProbe();

    const event = placementEvent();
    // Намеренно БЕЗ act(): подписка на стор обязана вызвать playSound синхронно
    // внутри setState — до какого-либо ре-рендера доски и flush эффектов. Если бы
    // звук по-прежнему жил в useEffect([lastEvent]), на этой строке он ещё не сыграл
    // бы (ждал бы paint + passive effects). Это и есть суть фикса задержки звука.
    useGameStore.setState({ lastEvent: event });
    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockPlaySound).toHaveBeenLastCalledWith('drop');

    act(() => {
      renderer.unmount();
    });
  });

  it('can dispatch placement feedback before persistence and React store subscribers', () => {
    const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
    const storeSource = fs.readFileSync(`${__dirname}/../store.ts`, 'utf8');
    const placementBlock = storeSource.slice(
      storeSource.indexOf('placePiece: (trayIndex, r, c) => {'),
      storeSource.indexOf('return result.event;', storeSource.indexOf('placePiece: (trayIndex, r, c) => {')),
    );

    expect(placementBlock).toContain('playPlacementFeedback(result.event');
    expect(placementBlock.indexOf('playPlacementFeedback(result.event')).toBeLessThan(
      placementBlock.indexOf('persistClassicSnapshot(result.state'),
    );
    expect(placementBlock.indexOf('playPlacementFeedback(result.event')).toBeLessThan(
      placementBlock.indexOf('set({'),
    );
  });

  it('uses Android haptics engine mappings for placement feedback', () => {
    const renderer = mountProbe();

    act(() => {
      useGameStore.setState({ lastEvent: placementEvent({ clearedRows: [0] }) });
    });

    expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledWith('confirm');
    expect(mockNotificationAsync).not.toHaveBeenCalled();
    expect(mockImpactAsync).not.toHaveBeenCalled();

    act(() => {
      renderer.unmount();
    });
  });

  it('does not replay an old placement when a retained screen mounts mid-run', () => {
    act(() => {
      useGameStore.setState({ lastEvent: placementEvent({ clearedRows: [0] }) });
    });
    expect(mockPlaySound).not.toHaveBeenCalled();

    const renderer = mountProbe();
    expect(mockPlaySound).not.toHaveBeenCalled();

    useGameStore.setState({ linesCleared: 1 });
    expect(mockPlaySound).not.toHaveBeenCalled();

    useGameStore.setState({ lastEvent: placementEvent({ clearedRows: [1] }) });
    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockPlaySound).toHaveBeenLastCalledWith('clear1');

    act(() => {
      renderer.unmount();
    });
  });

  it('deduplicates store feedback and overlapping game screen subscriptions', () => {
    const first = mountProbe();
    const second = mountProbe();
    const event = placementEvent({ clearedRows: [0] });

    playPlacementFeedback(event, { sound: true, haptics: true });
    useGameStore.setState({ lastEvent: event });
    useGameStore.setState({ linesCleared: 1 });

    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledTimes(1);
    act(() => { first.unmount(); second.unmount(); });
  });

  it('uses current feedback settings even before React commits a settings change', () => {
    const renderer = mountProbe();
    act(() => {
      useSettings.setState({ sound: false, haptics: false });
      useGameStore.setState({ lastEvent: placementEvent({ clearedRows: [0] }) });
    });

    expect(mockPlaySound).not.toHaveBeenCalled();
    expect(mockPerformAndroidHapticsAsync).not.toHaveBeenCalled();
    act(() => { renderer.unmount(); });
  });

  it('keeps the final destruction sound and haptic when the same placement ends the run', () => {
    const renderer = mountProbe();
    useGameStore.setState({ lastEvent: placementEvent({ gameOver: true, clearedRows: [0] }) });
    expect(mockPlaySound).toHaveBeenCalledWith('clear1');
    expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledWith('confirm');
    act(() => { renderer.unmount(); });
  });

  it('does not replay a handled placement event when settings toggle', () => {
    const renderer = mountProbe();

    act(() => {
      useGameStore.setState({ lastEvent: placementEvent() });
    });

    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledWith('gesture-end');

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
    expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledTimes(1);

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
        }),
      });
    });

    expect(mockPlaySound).toHaveBeenCalledWith('gameover');
    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledWith('reject');

    act(() => {
      useSettings.setState({ sound: false });
      useSettings.setState({ haptics: false });
    });
    act(() => {
      useSettings.setState({ sound: true, haptics: true });
    });

    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledTimes(1);

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

  it('clears a pending record timer when all feedback turns off and does not replay', () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    const renderer = mountProbe();

    act(() => {
      useGameStore.setState({
        recordCelebration: recordCelebration(12, 10),
        recordCelebrated: false,
      });
    });

    act(() => {
      jest.advanceTimersByTime(80);
    });

    act(() => {
      useSettings.setState({ sound: false, haptics: false });
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();

    act(() => {
      useSettings.setState({ sound: true, haptics: true });
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
      jest.advanceTimersByTime(80);
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
    expect(renderer.root.findByProps({ testID: 'new-record-bloom' })).toBeDefined();

    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(mockPlaySound).toHaveBeenCalledWith('record');
    expect(mockPlaySound.mock.calls.filter(([name]) => name === 'record')).toHaveLength(1);
    expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledWith('confirm');

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
      jest.advanceTimersByTime(1500);
    });
    // The episode stays mounted after its UI-thread keyframes finish; it is
    // invisible and cannot replay without a new record object/key.
    expect(activeCelebrationCount(renderer)).toBe(1);
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
