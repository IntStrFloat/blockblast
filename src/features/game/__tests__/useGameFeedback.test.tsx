import React from 'react';
import { act, create } from 'react-test-renderer';

import { useSettings } from '@/features/settings';

import { useGameStore } from '../store';
import { useGameFeedback } from '../sound/useGameFeedback';

const mockPlaySound = jest.fn();
const mockInitSounds = jest.fn();

jest.mock('../sound/sounds', () => ({
  initSounds: (...args: unknown[]) => mockInitSounds(...args),
  playSound: (...args: unknown[]) => mockPlaySound(...args),
}));

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

function Probe() {
  useGameFeedback();
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useSettings.setState({ sound: true, haptics: false });
  useGameStore.getState().newGame({ seed: 7 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useGameFeedback record celebration', () => {
  it('plays record sound from the active-run celebration event once and ignores terminal bookkeeping', () => {
    let renderer: ReturnType<typeof create> | null = null;

    act(() => {
      renderer = create(<Probe />);
    });

    act(() => {
      useGameStore.setState({
        finalResult: { newRecord: true, delta: 9 },
        recordCelebration: { score: 11, previousBest: 10 },
        recordCelebrated: false,
      });
    });

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(mockPlaySound).toHaveBeenCalledWith('record');
    expect(mockPlaySound).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().recordCelebrated).toBe(true);

    act(() => {
      useGameStore.setState({
        finalResult: { newRecord: true, delta: 12 },
      });
      jest.advanceTimersByTime(600);
    });

    expect(mockPlaySound).toHaveBeenCalledTimes(1);

    act(() => {
      renderer?.unmount();
    });
  });
});
