import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from '@/core/i18n';
import type { Lang } from '@/core/i18n';

import type { PushPermissionStatus } from '../softAsk';
import type { LocalNotificationKind, PlannedNotification } from './planner';

/**
 * Применение плана локальных уведомлений (retention фаза 4, спека 16).
 * Идемпотентно: отменяет всё запланированное и ставит свежий план. Молчит без
 * разрешения и на web. Контент собирается из i18n по kind + params.
 */

const CHANNEL_ID = 'retention';

export const LOCAL_NOTIFICATION_ROUTES: Record<LocalNotificationKind, string> = {
  streak: '/',
  tournamentEnd: '/leaderboard',
  prizeReady: '/leaderboard',
  seasonEnding: '/adventure',
};

export async function initLocalNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150],
    });
  }
}

export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export async function getLocalNotificationPermissionStatus(): Promise<PushPermissionStatus> {
  if (Platform.OS === 'web') return 'denied';
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  return current.canAskAgain ? 'undetermined' : 'denied';
}

function contentFor(item: PlannedNotification, lang: Lang): { title: string; body: string } {
  const { kind, params } = item;
  if (kind === 'streak') {
    return {
      title: `🔥 ${t('notif.streakTitle', lang)} ${params.streakCount ?? 1}`,
      body: t('notif.streakBody', lang),
    };
  }
  if (kind === 'tournamentEnd') {
    return {
      title: `🏆 ${t('notif.tournamentTitle', lang)}`,
      body:
        params.rank != null
          ? `${t('notif.tournamentBodyRanked', lang)} #${params.rank}. ${t('notif.tournamentBodyTail', lang)}`
          : t('notif.tournamentBody', lang),
    };
  }
  if (kind === 'prizeReady') {
    return { title: `🎁 ${t('notif.prizeTitle', lang)}`, body: t('notif.prizeBody', lang) };
  }
  return { title: `⏳ ${t('notif.seasonTitle', lang)}`, body: t('notif.seasonBody', lang) };
}

export async function applyLocalNotificationPlan(
  plan: PlannedNotification[],
  lang: Lang,
): Promise<void> {
  if (Platform.OS === 'web') return;
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const item of plan) {
    const { title, body } = contentFor(item, lang);
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { kind: item.kind, route: LOCAL_NOTIFICATION_ROUTES[item.kind] },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.fireAt,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
  }
}
