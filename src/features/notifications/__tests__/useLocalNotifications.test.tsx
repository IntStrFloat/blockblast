import * as Notifications from 'expo-notifications';
import React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { LocalNotificationKind, PlannedNotification } from '../local/planner';

let appStateListener: ((state: 'active' | 'inactive' | 'background') => void) | undefined;
let notificationResponseListener:
  | ((event: Notifications.NotificationResponse) => void)
  | undefined;
let mockLeaderboardState: {
  snapshot: { weekKey: string; currentPlayer: { rank: number | null } } | null;
  localWeeklyResult: { weekKey: string } | null;
  weeklyPrizes?: { weekKey: string; claimed: boolean; origin?: 'server' | 'legacy_local' }[];
};
const mockGetUtcWeekWindow = jest.fn((date?: Date) => {
  const iso = (date ?? new Date()).toISOString().slice(0, 10);
  if (iso === '2026-08-24') {
    return { weekKey: '2026-08-24' };
  }
  if (iso === '2026-08-17') {
    return { weekKey: '2026-08-17' };
  }
  return { weekKey: '2026-W34' };
});

const mockNavigate = jest.fn();
const mockTrack = jest.fn();
const mockRecordNotificationAttribution = jest.fn();
const mockObservedPermission = jest.fn((_status?: string) => ({
  previous: null as string | null,
  unsubscribed: false,
}));
const mockInitLocalNotifications = jest.fn(() => Promise.resolve());
const mockApplyLocalNotificationPlan = jest.fn<
  Promise<{ scheduledKinds: LocalNotificationKind[] }>,
  [unknown, unknown]
>(() => Promise.resolve({ scheduledKinds: [] }));
const mockPlanLocalNotifications = jest.fn<PlannedNotification[], [unknown, unknown]>(() => []);

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/features/analytics', () => ({
  recordNotificationAttribution: mockRecordNotificationAttribution,
  useAnalyticsStore: {
    getState: () => ({ track: mockTrack }),
  },
}));

jest.mock('@/features/settings', () => ({
  useLang: () => 'ru',
}));

jest.mock('@/features/adventure/store', () => ({
  useAdventure: {
    getState: () => ({
      seasonWindow: null,
      levelIndex: 0,
      trophies: [],
    }),
  },
}));

jest.mock('@/features/game/store', () => ({
  getSavedAdventureSummary: () => ({ kind: 'none' }),
  getSavedGameSummary: () => ({ canContinue: false }),
}));

jest.mock('@/features/leaderboard/store', () => ({
  useLeaderboardStore: {
    getState: () => mockLeaderboardState,
  },
}));

jest.mock('@/features/leaderboard/week', () => ({
  getUtcWeekWindow: (date?: Date) => mockGetUtcWeekWindow(date),
}));

jest.mock('@/features/streak', () => ({
  canUseProtector: () => true,
  todayISO: () => '2026-08-23',
  useStreak: {
    getState: () => ({ lastDay: '2026-08-23', count: 4, protectorLastUsedDay: null }),
  },
}));

jest.mock('../local/planner', () => ({
  planLocalNotifications: mockPlanLocalNotifications,
}));

jest.mock('../local/scheduler', () => ({
  initLocalNotifications: () => mockInitLocalNotifications(),
  applyLocalNotificationPlan: mockApplyLocalNotificationPlan,
  getLocalNotificationPermissionStatus: () => Promise.resolve('undetermined'),
  LOCAL_NOTIFICATION_ROUTES: {
    streak: '/',
    tournamentEnd: '/leaderboard',
    prizeReady: '/leaderboard',
    savedRun: '/',
    seasonEnding: '/adventure',
  },
}));

jest.mock('../softAsk', () => ({
  recordObservedPushPermissionStatus: (status: string) => mockObservedPermission(status),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const localNotificationsModule = require('../local/useLocalNotifications') as typeof import('../local/useLocalNotifications');
const {
  useLocalNotifications: useLocalNotificationsHook,
  getManagedLocalNotificationResponse,
  shouldReplanOnAppStateChange: shouldReplanOnAppStateChangeFn,
} = localNotificationsModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resetInitialSessionIntentForTests } = require('../startupIntent') as typeof import('../startupIntent');

type NotificationsModule = typeof Notifications & {
  addNotificationResponseReceivedListener: jest.Mock;
  getLastNotificationResponseAsync: jest.Mock;
  clearLastNotificationResponseAsync: jest.Mock;
};

function makeNotificationResponse(
  overrides: Partial<Notifications.NotificationResponse> & {
    kind?: LocalNotificationKind;
    route?: unknown;
    identifier?: string;
    actionIdentifier?: string;
  } = {},
): Notifications.NotificationResponse {
  const {
    kind = 'streak',
    route = '/',
    identifier = 'retention:streak',
    actionIdentifier = 'tap',
    ...rest
  } = overrides;
  return {
    actionIdentifier,
    notification: {
      date: Date.now(),
      request: {
        identifier,
        content: {
          title: 'Reminder',
          subtitle: null,
          body: 'Come back',
          categoryIdentifier: null,
          sound: null,
          data: { kind, route },
        },
        trigger: null,
      },
    },
    ...rest,
  } as Notifications.NotificationResponse;
}

function Probe({ navigationReady = true }: { navigationReady?: boolean }) {
  useLocalNotificationsHook(navigationReady);
  return null;
}

describe('useLocalNotifications', () => {
  let tree: ReactTestRenderer | null = null;
  const notifications = Notifications as NotificationsModule;

  beforeEach(() => {
    resetInitialSessionIntentForTests();
    jest.useRealTimers();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener as typeof appStateListener;
      return { remove: jest.fn() } as never;
    });
    appStateListener = undefined;
    notificationResponseListener = undefined;
    mockLeaderboardState = {
      snapshot: null,
      localWeeklyResult: null,
      weeklyPrizes: [],
    };
    mockGetUtcWeekWindow.mockClear();
    mockNavigate.mockReset();
    mockTrack.mockReset();
    mockRecordNotificationAttribution.mockReset();
    mockObservedPermission.mockReset();
    mockObservedPermission.mockReturnValue({ previous: null, unsubscribed: false });
    mockInitLocalNotifications.mockClear();
    mockPlanLocalNotifications.mockReset();
    mockPlanLocalNotifications.mockReturnValue([
      {
        kind: 'streak',
        fireAt: new Date(2026, 7, 24, 19, 0, 0),
        params: { streakCount: 4 },
      },
    ]);
    mockApplyLocalNotificationPlan.mockReset();
    mockApplyLocalNotificationPlan.mockResolvedValue({ scheduledKinds: ['streak'] });
    notifications.addNotificationResponseReceivedListener.mockImplementation((listener) => {
      notificationResponseListener = listener;
      return { remove: jest.fn() };
    });
    notifications.getLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);
    notifications.clearLastNotificationResponseAsync = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (tree) {
      act(() => {
        tree?.unmount();
      });
    }
    tree = null;
    jest.restoreAllMocks();
  });

  it('replans on backgrounding and foregrounding', () => {
    expect(shouldReplanOnAppStateChangeFn('active', 'inactive')).toBe(true);
    expect(shouldReplanOnAppStateChangeFn('active', 'background')).toBe(true);
    expect(shouldReplanOnAppStateChangeFn('inactive', 'background')).toBe(false);
    expect(shouldReplanOnAppStateChangeFn('background', 'active')).toBe(true);
    expect(shouldReplanOnAppStateChangeFn('active', 'active')).toBe(false);
  });

  it('recognizes only managed local notification kind/route pairs', () => {
    expect(getManagedLocalNotificationResponse(makeNotificationResponse())).toEqual({
      kind: 'streak',
      route: '/',
      responseKey: expect.stringMatching(/^retention:streak:tap:\d+$/),
    });
    expect(
      getManagedLocalNotificationResponse(
        makeNotificationResponse({ route: 'https://evil.example' }),
      ),
    ).toBeNull();
    expect(
      getManagedLocalNotificationResponse(
        makeNotificationResponse({ kind: 'streak', route: '/leaderboard' }),
      ),
    ).toBeNull();
    expect(
      getManagedLocalNotificationResponse(
        makeNotificationResponse({
          kind: 'savedRun',
          route: '/adventure-level',
          identifier: 'retention:savedRun',
        }),
      ),
    ).toMatchObject({ kind: 'savedRun', route: '/adventure-level' });
  });

  it('tracks only reminders that were actually scheduled and ignores inactive->background duplicates', async () => {
    await act(async () => {
      tree = create(<Probe />);
    });

    expect(mockInitLocalNotifications).toHaveBeenCalledTimes(1);
    expect(appStateListener).toBeDefined();

    await act(async () => {
      appStateListener?.('inactive');
      await Promise.resolve();
    });
    await act(async () => {
      appStateListener?.('background');
      await Promise.resolve();
    });

    expect(mockPlanLocalNotifications).toHaveBeenCalledTimes(2);
    expect(mockApplyLocalNotificationPlan).toHaveBeenCalledTimes(2);
    expect(mockPlanLocalNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        protectorAvailable: true,
      }),
      expect.any(Date),
    );
    expect(mockTrack).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenCalledWith('notification_scheduled', { kind: 'streak' });
  });

  it('tracks a granted-to-denied OS transition as an unsubscribe', async () => {
    mockObservedPermission.mockReturnValue({
      previous: 'granted',
      unsubscribed: true,
    });
    await act(async () => {
      tree = create(<Probe />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockTrack).toHaveBeenCalledWith('notification_unsubscribed', { source: 'system' });
  });

  it('on Monday uses previous-week participation for prizeReady and current-week participation for tournamentEnd', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 24, 9, 0, 0));
    mockLeaderboardState = {
      snapshot: null,
      localWeeklyResult: { weekKey: '2026-08-17' },
      weeklyPrizes: [],
    };

    await act(async () => {
      tree = create(<Probe />);
    });

    await act(async () => {
      appStateListener?.('background');
      await Promise.resolve();
    });

    expect(mockPlanLocalNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentPlayedThisWeek: false,
        tournamentCurrentRank: null,
        prizePlayedTargetWeek: true,
      }),
      expect.any(Date),
    );
  });

  it('on Monday treats only an unclaimed previous-week prize as prizeReady', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 24, 9, 0, 0));
    mockLeaderboardState = {
      snapshot: null,
      localWeeklyResult: null,
      weeklyPrizes: [{ weekKey: '2026-08-17', claimed: false, origin: 'server' }],
    };

    await act(async () => {
      tree = create(<Probe />);
    });

    await act(async () => {
      appStateListener?.('background');
      await Promise.resolve();
    });

    expect(mockPlanLocalNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ prizePlayedTargetWeek: true }),
      expect.any(Date),
    );
  });

  it('on Monday does not reschedule prizeReady after the previous-week prize was claimed', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 24, 9, 0, 0));
    mockLeaderboardState = {
      snapshot: null,
      localWeeklyResult: null,
      weeklyPrizes: [{ weekKey: '2026-08-17', claimed: true, origin: 'server' }],
    };

    await act(async () => {
      tree = create(<Probe />);
    });

    await act(async () => {
      appStateListener?.('background');
      await Promise.resolve();
    });

    expect(mockPlanLocalNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ prizePlayedTargetWeek: false }),
      expect.any(Date),
    );
  });

  it('does not emit notification_scheduled when the scheduler produced no real schedules', async () => {
    mockApplyLocalNotificationPlan.mockResolvedValue({ scheduledKinds: [] });

    await act(async () => {
      tree = create(<Probe />);
    });

    await act(async () => {
      appStateListener?.('background');
      await Promise.resolve();
    });

    expect(mockApplyLocalNotificationPlan).toHaveBeenCalledTimes(2);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('handles a managed cold-start response, tracks it, navigates, and clears the stored response', async () => {
    notifications.getLastNotificationResponseAsync.mockResolvedValue(makeNotificationResponse());

    await act(async () => {
      tree = create(<Probe />);
      await Promise.resolve();
    });

    expect(mockTrack).toHaveBeenCalledWith('notification_opened', {
      kind: 'streak',
      origin: 'local',
      attribution_id: expect.stringMatching(/^retention:streak:tap:/),
      route: '/',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(notifications.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('defers cold-start navigation until the root navigator is ready', async () => {
    notifications.getLastNotificationResponseAsync.mockResolvedValue(makeNotificationResponse());

    await act(async () => {
      tree = create(<Probe navigationReady={false} />);
      await Promise.resolve();
    });

    expect(mockTrack).toHaveBeenCalledWith('notification_opened', {
      kind: 'streak',
      origin: 'local',
      attribution_id: expect.stringMatching(/^retention:streak:tap:/),
      route: '/',
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      tree?.update(<Probe navigationReady />);
      await Promise.resolve();
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('suppresses duplicate handling when listener and last response race on the same tap', async () => {
    let resolveLastResponse: ((value: Notifications.NotificationResponse | null) => void) | null =
      null;
    const response = makeNotificationResponse();
    notifications.getLastNotificationResponseAsync.mockImplementation(
      () =>
        new Promise<Notifications.NotificationResponse | null>((resolve) => {
          resolveLastResponse = resolve;
        }),
    );

    await act(async () => {
      tree = create(<Probe />);
    });

    await act(async () => {
      notificationResponseListener?.(response);
      await Promise.resolve();
    });
    await act(async () => {
      resolveLastResponse?.(response);
      await Promise.resolve();
    });

    const openedCalls = mockTrack.mock.calls.filter(([name]) => name === 'notification_opened');
    expect(openedCalls).toHaveLength(1);
    expect(mockTrack).toHaveBeenCalledWith('notification_opened', {
      kind: 'streak',
      origin: 'local',
      attribution_id: expect.stringMatching(/^retention:streak:tap:/),
      route: '/',
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(notifications.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('allows two different deliveries with the same stable identifier and action', async () => {
    await act(async () => {
      tree = create(<Probe />);
    });

    await act(async () => {
      notificationResponseListener?.(
        makeNotificationResponse({
          identifier: 'retention:streak',
          actionIdentifier: 'tap',
          notification: {
            date: new Date(2026, 7, 23, 12, 0, 0).getTime(),
            request: {
              identifier: 'retention:streak',
              content: {
                title: 'Reminder',
                subtitle: null,
                body: 'Come back',
                categoryIdentifier: null,
                sound: null,
                data: { kind: 'streak', route: '/' },
              },
              trigger: null,
            },
          } as Notifications.Notification,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      notificationResponseListener?.(
        makeNotificationResponse({
          identifier: 'retention:streak',
          actionIdentifier: 'tap',
          notification: {
            date: new Date(2026, 7, 24, 12, 0, 0).getTime(),
            request: {
              identifier: 'retention:streak',
              content: {
                title: 'Reminder',
                subtitle: null,
                body: 'Come back',
                categoryIdentifier: null,
                sound: null,
                data: { kind: 'streak', route: '/' },
              },
              trigger: null,
            },
          } as Notifications.Notification,
        }),
      );
      await Promise.resolve();
    });

    const openedCalls = mockTrack.mock.calls.filter(([name]) => name === 'notification_opened');
    expect(openedCalls).toHaveLength(2);
    expect(openedCalls[0]).toEqual(['notification_opened', expect.objectContaining({
      kind: 'streak', origin: 'local', route: '/',
    })]);
    expect(openedCalls[1]).toEqual(['notification_opened', expect.objectContaining({
      kind: 'streak', origin: 'local', route: '/',
    })]);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/');
  });

  it('ignores unrelated cold-start responses and does not clear them', async () => {
    notifications.getLastNotificationResponseAsync.mockResolvedValue(
      makeNotificationResponse({ route: 'https://evil.example' }),
    );

    await act(async () => {
      tree = create(<Probe />);
      await Promise.resolve();
    });

    expect(mockTrack).not.toHaveBeenCalledWith('notification_opened', expect.anything());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(notifications.clearLastNotificationResponseAsync).not.toHaveBeenCalled();
  });
});
