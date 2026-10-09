import * as Notifications from 'expo-notifications';

import { t, type Lang } from '@/core/i18n';

import type { PlannedNotification } from '../local/planner';
import {
  applyLocalNotificationPlan,
  LOCAL_NOTIFICATION_ROUTES,
} from '../local/scheduler';

const LANG: Lang = 'ru';

type NotificationsModule = typeof Notifications & {
  getAllScheduledNotificationsAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
};

function textFor(item: PlannedNotification, lang: Lang) {
  if (item.kind === 'streak') {
    return {
      title: `🔥 ${t('notif.streakTitle', lang)} ${item.params.streakCount ?? 1}`,
      body: t('notif.streakBody', lang),
    };
  }
  if (item.kind === 'tournamentEnd') {
    return {
      title: `🏆 ${t('notif.tournamentTitle', lang)}`,
      body:
        item.params.rank != null
          ? `${t('notif.tournamentBodyRanked', lang)} #${item.params.rank}. ${t('notif.tournamentBodyTail', lang)}`
          : t('notif.tournamentBody', lang),
    };
  }
  if (item.kind === 'prizeReady') {
    return {
      title: `🎁 ${t('notif.prizeTitle', lang)}`,
      body: t('notif.prizeBody', lang),
    };
  }
  if (item.kind === 'savedRun') {
    return {
      title: `💾 ${t('notif.savedTitle', lang)}`,
      body: t(
        item.params.savedMode === 'adventure'
          ? 'notif.savedAdventureBody'
          : 'notif.savedClassicBody',
        lang,
      ),
    };
  }
  return {
    title: `⏳ ${t('notif.seasonTitle', lang)}`,
    body: t('notif.seasonBody', lang),
  };
}

function existingRequest(
  item: PlannedNotification,
  identifier: string,
  triggerOverrides?: Record<string, unknown>,
): Notifications.NotificationRequest {
  const { title, body } = textFor(item, LANG);
  return {
    identifier,
    content: {
      title,
      body,
      data: {
        kind: item.kind,
        route: LOCAL_NOTIFICATION_ROUTES[item.kind],
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: item.fireAt.getTime(),
      channelId: 'retention',
      ...triggerOverrides,
    },
  } as unknown as Notifications.NotificationRequest;
}

describe('applyLocalNotificationPlan', () => {
  const notifications = Notifications as NotificationsModule;

  beforeEach(() => {
    notifications.getAllScheduledNotificationsAsync = jest.fn().mockResolvedValue([]);
    notifications.cancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);
    (Notifications.getPermissionsAsync as unknown as jest.Mock).mockResolvedValue({ granted: true });
    (Notifications.scheduleNotificationAsync as unknown as jest.Mock).mockReset();
    (Notifications.scheduleNotificationAsync as unknown as jest.Mock).mockResolvedValue('scheduled-id');
  });

  it('does nothing without granted permission', async () => {
    (Notifications.getPermissionsAsync as unknown as jest.Mock).mockResolvedValue({ granted: false });

    const result = await applyLocalNotificationPlan(
      [{ kind: 'streak', fireAt: new Date(2026, 7, 24, 19, 0, 0), params: { streakCount: 4 } }],
      LANG,
    );

    expect(result).toEqual({ scheduledKinds: [] });
    expect(notifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels the legacy season reminder even after permission was revoked', async () => {
    (Notifications.getPermissionsAsync as unknown as jest.Mock).mockResolvedValue({ granted: false });
    const legacySeason: PlannedNotification = {
      kind: 'seasonEnding',
      fireAt: new Date(2026, 7, 24, 17, 0, 0),
      params: {},
    };
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      existingRequest(legacySeason, 'retention:seasonEnding'),
    ]);

    await applyLocalNotificationPlan([], LANG);

    expect(notifications.cancelScheduledNotificationAsync)
      .toHaveBeenCalledWith('retention:seasonEnding');
  });

  it('keeps an identical managed plan without cancel or reschedule', async () => {
    const streak: PlannedNotification = {
      kind: 'streak',
      fireAt: new Date(2026, 7, 24, 19, 0, 0),
      params: { streakCount: 5 },
    };
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      existingRequest(streak, 'legacy-streak-id'),
    ]);

    const result = await applyLocalNotificationPlan([streak], LANG);

    expect(result).toEqual({ scheduledKinds: [] });
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('keeps an identical managed plan when the native trigger is serialized with timestamp', async () => {
    const streak: PlannedNotification = {
      kind: 'streak',
      fireAt: new Date(2026, 7, 24, 19, 0, 0),
      params: { streakCount: 5 },
    };
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      existingRequest(streak, 'native-streak-id', {
        date: undefined,
        timestamp: streak.fireAt.getTime(),
      }),
    ]);

    const result = await applyLocalNotificationPlan([streak], LANG);

    expect(result).toEqual({ scheduledKinds: [] });
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels only stale managed reminders and schedules changed ones', async () => {
    const streak: PlannedNotification = {
      kind: 'streak',
      fireAt: new Date(2026, 7, 24, 19, 0, 0),
      params: { streakCount: 3 },
    };
    const prize: PlannedNotification = {
      kind: 'prizeReady',
      fireAt: new Date(2026, 7, 25, 11, 0, 0),
      params: {},
    };

    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      existingRequest(
        { ...streak, fireAt: new Date(2026, 7, 23, 19, 0, 0) },
        'old-streak-id',
      ),
      existingRequest(prize, 'legacy-prize-id'),
    ]);

    const result = await applyLocalNotificationPlan([streak, prize], LANG);

    expect(result).toEqual({ scheduledKinds: ['streak'] });
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-streak-id');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'retention:streak',
        content: expect.objectContaining({
          data: { kind: 'streak', route: '/' },
        }),
      }),
    );
  });

  it('cancels a legacy season-ending reminder when the safe plan disables it', async () => {
    const legacySeason: PlannedNotification = {
      kind: 'seasonEnding',
      fireAt: new Date(2026, 7, 24, 17, 0, 0),
      params: {},
    };
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      existingRequest(legacySeason, 'retention:seasonEnding'),
    ]);

    const result = await applyLocalNotificationPlan([], LANG);

    expect(result).toEqual({ scheduledKinds: [] });
    expect(notifications.cancelScheduledNotificationAsync)
      .toHaveBeenCalledWith('retention:seasonEnding');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('continues scheduling the rest of the plan after a single schedule failure', async () => {
    (Notifications.scheduleNotificationAsync as unknown as jest.Mock)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('scheduled-prize');

    const result = await applyLocalNotificationPlan(
      [
        {
          kind: 'streak',
          fireAt: new Date(2026, 7, 24, 19, 0, 0),
          params: { streakCount: 2 },
        },
        {
          kind: 'prizeReady',
          fireAt: new Date(2026, 7, 25, 11, 0, 0),
          params: {},
        },
      ],
      LANG,
    );

    expect(result).toEqual({ scheduledKinds: ['prizeReady'] });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('routes a saved Adventure run directly to its resumable level', async () => {
    const saved: PlannedNotification = {
      kind: 'savedRun',
      fireAt: new Date(2026, 7, 25, 18, 0, 0),
      params: { savedMode: 'adventure' },
    };

    const result = await applyLocalNotificationPlan([saved], LANG);

    expect(result).toEqual({ scheduledKinds: ['savedRun'] });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'retention:savedRun',
        content: expect.objectContaining({
          data: { kind: 'savedRun', route: '/adventure-level' },
        }),
      }),
    );
  });
});
