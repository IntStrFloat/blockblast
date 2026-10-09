import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

import { NoopPushProvider } from '../noop';
import { getInitialSessionIntent, resetInitialSessionIntentForTests } from '../startupIntent';

type NotificationsModule = typeof Notifications & {
  getLastNotificationResponseAsync: jest.Mock;
};
const notifications = Notifications as NotificationsModule;

function makeLocalResponse() {
  return {
    actionIdentifier: 'tap',
    notification: {
      date: 1234,
      request: {
        identifier: 'retention:streak',
        content: { data: { kind: 'streak', route: '/' } },
        trigger: null,
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

describe('initial session intent', () => {
  beforeEach(() => {
    resetInitialSessionIntentForTests();
    jest.spyOn(NoopPushProvider, 'getInitialNotificationTap').mockResolvedValue(null);
    notifications.getLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('memoizes one read and gives RuStore notification priority', async () => {
    const remoteTap = {
      id: 'push-1',
      route: '/leaderboard',
      kind: 'weekly',
    };
    jest.mocked(NoopPushProvider.getInitialNotificationTap).mockResolvedValue(remoteTap);
    notifications.getLastNotificationResponseAsync.mockResolvedValue(makeLocalResponse());
    jest.mocked(Linking.getInitialURL).mockResolvedValue('blockblast://game');

    const first = getInitialSessionIntent();
    const second = getInitialSessionIntent();

    expect(second).toBe(first);
    await expect(first).resolves.toEqual({
      source: 'notification',
      remoteTap,
      localTap: null,
    });
    expect(NoopPushProvider.getInitialNotificationTap).toHaveBeenCalledTimes(1);
    expect(notifications.getLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    expect(Linking.getInitialURL).toHaveBeenCalledTimes(1);
  });

  it('recognizes one shared local notification response before a deeplink', async () => {
    notifications.getLastNotificationResponseAsync.mockResolvedValue(makeLocalResponse());
    jest.mocked(Linking.getInitialURL).mockResolvedValue('blockblast://game');

    await expect(getInitialSessionIntent()).resolves.toEqual({
      source: 'notification',
      remoteTap: null,
      localTap: expect.objectContaining({ kind: 'streak', route: '/' }),
    });
  });

  it('falls back from deeplink to an ordinary app launch only after all readers resolve', async () => {
    jest.mocked(Linking.getInitialURL).mockResolvedValue('blockblast://game');
    await expect(getInitialSessionIntent()).resolves.toEqual({
      source: 'deeplink',
      remoteTap: null,
      localTap: null,
    });

    resetInitialSessionIntentForTests();
    jest.mocked(Linking.getInitialURL).mockResolvedValue(null);
    await expect(getInitialSessionIntent()).resolves.toEqual({
      source: 'organic',
      remoteTap: null,
      localTap: null,
    });
  });
});
