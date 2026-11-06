import React from 'react';
import { act, create } from 'react-test-renderer';

import { KEYS, removeKey } from '@/core/storage';

import { HomePromptHost } from '../HomePromptHost';
import { recordMeaningfulSessionForPush, recordFirstRecordForPush } from '../softAsk';

const mockTrack = jest.fn();
const mockTrackOnce = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetPermissionStatus = jest.fn();
const mockClaimAutoPrompt = jest.fn(() => true);

jest.mock('expo-router', () => ({ usePathname: () => '/' }));
jest.mock('@/core/i18n', () => ({ t: (key: string) => key }));
jest.mock('@/features/settings', () => ({ useLang: () => 'ru' }));
jest.mock('@/features/analytics', () => ({
  useAnalyticsStore: {
    getState: () => ({ track: mockTrack, trackOnce: mockTrackOnce }),
  },
}));
jest.mock('@/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactModule = require('react');
  return {
    AppText: 'AppText',
    GameButton: (props: object) => ReactModule.createElement('GameButton', props),
    Overlay: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement('Overlay', null, children),
  };
});
jest.mock('../autoPromptSession', () => ({
  claimAutoPrompt: () => mockClaimAutoPrompt(),
}));
jest.mock('../local/scheduler', () => ({
  getLocalNotificationPermissionStatus: () => mockGetPermissionStatus(),
}));
jest.mock('../permissions', () => ({
  requestNotificationPermissions: (source: string) => mockRequestPermissions(source),
}));

describe('HomePromptHost', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    removeKey(KEYS.pushPrompt);
    mockRequestPermissions.mockResolvedValue({
      local: 'granted',
      remote: 'unavailable',
      outcome: 'granted',
    });
    mockGetPermissionStatus.mockResolvedValue('undetermined');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function recordAdventureSessions() {
    recordMeaningfulSessionForPush('session-1', 'adventure');
    recordMeaningfulSessionForPush('session-2', 'adventure');
    recordMeaningfulSessionForPush('session-3', 'adventure');
    recordFirstRecordForPush('record-1');
  }

  it('shows after a record with no gamesPlayed gate and records OS result separately', async () => {
    recordAdventureSessions();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <HomePromptHost
          ftueComplete
          isFirstSession={false}
          permissionStatus="undetermined"
        />,
      );
    });
    act(() => { jest.runOnlyPendingTimers(); });

    expect(renderer.root.findByType('Overlay' as never)).toBeDefined();
    expect(mockTrack).toHaveBeenCalledWith('notification_soft_ask_shown', {
      meaningful_sessions: 3,
      last_meaningful_mode: 'classic',
    });
    const allow = renderer.root.findAllByType('GameButton' as never)
      .find((node) => node.props.label === 'push.allow')!;
    await act(async () => { await allow.props.onPress(); });

    expect(mockTrack).toHaveBeenCalledWith('notification_soft_ask_result', {
      result: 'accepted',
      last_meaningful_mode: 'classic',
    });
    expect(mockRequestPermissions).toHaveBeenCalledWith('soft_ask');
  });

  it('waits for the record and does not repeat after Later', () => {
    recordMeaningfulSessionForPush('session-1', 'adventure');
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <HomePromptHost
          ftueComplete
          isFirstSession
          permissionStatus="undetermined"
        />,
      );
    });
    act(() => { jest.runOnlyPendingTimers(); });
    expect(renderer.root.findAllByType('Overlay' as never)).toHaveLength(0);
    recordFirstRecordForPush('record-1');

    act(() => {
      renderer.update(
        <HomePromptHost
          ftueComplete
          isFirstSession={false}
          permissionStatus="undetermined"
        />,
      );
    });
    act(() => { jest.runOnlyPendingTimers(); });
    const later = renderer.root.findAllByType('GameButton' as never)
      .find((node) => node.props.label === 'push.later')!;
    act(() => { later.props.onPress(); });
    act(() => {
      renderer.update(
        <HomePromptHost
          ftueComplete
          isFirstSession={false}
          permissionStatus="undetermined"
        />,
      );
    });
    act(() => { jest.runOnlyPendingTimers(); });
    expect(renderer.root.findAllByType('Overlay' as never)).toHaveLength(0);
  });

  it('blocks the prompt and records a permission probe API error', async () => {
    recordAdventureSessions();
    mockGetPermissionStatus.mockRejectedValue(new Error('permission api unavailable'));
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <HomePromptHost ftueComplete isFirstSession={false} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => { jest.runOnlyPendingTimers(); });

    expect(renderer.root.findAllByType('Overlay' as never)).toHaveLength(0);
    expect(mockTrack).toHaveBeenCalledWith('notification_permission_probe_error', {
      surface: 'home',
    });
  });
});
