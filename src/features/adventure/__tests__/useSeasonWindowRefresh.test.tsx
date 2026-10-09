import React from 'react';
import { act, create } from 'react-test-renderer';

import { useProfileStore } from '@/features/profile';

import { useSeasonWindowRefresh } from '../hooks/useSeasonWindowRefresh';
import { useAdventure } from '../store';

jest.mock('expo-router', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback]);
    },
  };
});

function Probe() {
  useSeasonWindowRefresh();
  return null;
}

describe('useSeasonWindowRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-19T20:59:30.000Z'));
    useAdventure.getState().reset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('refreshes a window that expires while Home remains mounted', async () => {
    const nowMs = Date.now();
    const syncSeasonWindow = jest.fn().mockResolvedValue(null);
    useProfileStore.setState({ authToken: 'token-1' });
    useAdventure.setState({
      seasonWindow: {
        seasonId: 1,
        serverNowIso: new Date(nowMs).toISOString(),
        windowStartIso: '2026-07-05T21:00:00.000Z',
        windowEndIso: '2026-07-19T21:00:00.000Z',
        durationDays: 14,
      },
      seasonWindowSyncedAtMs: nowMs,
      syncSeasonWindow,
    });
    let tree!: ReturnType<typeof create>;
    act(() => { tree = create(<Probe />); });
    expect(syncSeasonWindow).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(syncSeasonWindow).toHaveBeenCalledWith('token-1', { nowMs: Date.now() });
    act(() => tree.unmount());
  });

  it('contains a rejected cold-start bootstrap and keeps the screen mounted', async () => {
    useProfileStore.setState({
      authToken: null,
      bootstrapRemote: jest.fn().mockRejectedValue(new Error('offline')),
    });
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<Probe />);
      await Promise.resolve();
    });

    expect(useProfileStore.getState().bootstrapRemote).toHaveBeenCalledTimes(1);
    expect(tree.toJSON()).toBeNull();
    act(() => tree.unmount());
  });
});
