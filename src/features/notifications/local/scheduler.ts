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
const IDENTIFIER_PREFIX = 'retention:';

export interface ApplyLocalNotificationPlanResult {
  scheduledKinds: LocalNotificationKind[];
}

export const LOCAL_NOTIFICATION_ROUTES: Record<LocalNotificationKind, string> = {
  streak: '/',
  tournamentEnd: '/leaderboard',
  prizeReady: '/leaderboard',
  savedRun: '/',
  seasonEnding: '/adventure',
};

const LOCAL_NOTIFICATION_IDENTIFIERS: Record<LocalNotificationKind, string> = {
  streak: `${IDENTIFIER_PREFIX}streak`,
  tournamentEnd: `${IDENTIFIER_PREFIX}tournamentEnd`,
  prizeReady: `${IDENTIFIER_PREFIX}prizeReady`,
  savedRun: `${IDENTIFIER_PREFIX}savedRun`,
  seasonEnding: `${IDENTIFIER_PREFIX}seasonEnding`,
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
  if (kind === 'savedRun') {
    return {
      title: `💾 ${t('notif.savedTitle', lang)}`,
      body: t(
        params.savedMode === 'adventure'
          ? 'notif.savedAdventureBody'
          : 'notif.savedClassicBody',
        lang,
      ),
    };
  }
  return { title: `⏳ ${t('notif.seasonTitle', lang)}`, body: t('notif.seasonBody', lang) };
}

interface ManagedScheduledNotification {
  identifier: string;
  kind: LocalNotificationKind;
  title: string | null;
  body: string | null;
  route: string;
  dateMs: number | null;
}

interface DesiredScheduledNotification {
  identifier: string;
  kind: LocalNotificationKind;
  title: string;
  body: string;
  route: string;
  fireAt: Date;
}

function isLocalNotificationKind(value: unknown): value is LocalNotificationKind {
  return (
    value === 'streak' ||
    value === 'tournamentEnd' ||
    value === 'prizeReady' ||
    value === 'savedRun' ||
    value === 'seasonEnding'
  );
}

function readTriggerDateMs(trigger: unknown): number | null {
  if (!trigger || typeof trigger !== 'object') return null;
  const nativeDateTrigger = trigger as {
    date?: unknown;
    timestamp?: unknown;
    value?: unknown;
  };
  const rawDate =
    nativeDateTrigger.date ?? nativeDateTrigger.timestamp ?? nativeDateTrigger.value;
  if (rawDate instanceof Date) return rawDate.getTime();
  if (typeof rawDate === 'number') return rawDate;
  if (typeof rawDate === 'string') {
    const parsed = Date.parse(rawDate);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function readManagedScheduledNotification(
  request: Notifications.NotificationRequest,
): ManagedScheduledNotification | null {
  const data = request.content.data as Record<string, unknown> | undefined;
  const kind = data?.kind;
  if (!isLocalNotificationKind(kind)) return null;

  return {
    identifier: request.identifier,
    kind,
    title: request.content.title,
    body: request.content.body,
    route: typeof data?.route === 'string' ? data.route : LOCAL_NOTIFICATION_ROUTES[kind],
    dateMs: readTriggerDateMs(request.trigger),
  };
}

function buildDesiredScheduledNotification(
  item: PlannedNotification,
  lang: Lang,
): DesiredScheduledNotification {
  const { title, body } = contentFor(item, lang);
  return {
    identifier: LOCAL_NOTIFICATION_IDENTIFIERS[item.kind],
    kind: item.kind,
    title,
    body,
    route: item.kind === 'savedRun'
      ? item.params.savedMode === 'adventure'
        ? '/adventure-level'
        : '/game'
      : LOCAL_NOTIFICATION_ROUTES[item.kind],
    fireAt: item.fireAt,
  };
}

function matchesDesiredNotification(
  existing: ManagedScheduledNotification,
  desired: DesiredScheduledNotification,
): boolean {
  return (
    existing.kind === desired.kind &&
    existing.title === desired.title &&
    existing.body === desired.body &&
    existing.route === desired.route &&
    existing.dateMs === desired.fireAt.getTime()
  );
}

export async function applyLocalNotificationPlan(
  plan: PlannedNotification[],
  lang: Lang,
): Promise<ApplyLocalNotificationPlanResult> {
  if (Platform.OS === 'web') return { scheduledKinds: [] };
  const permissions = await Notifications.getPermissionsAsync();
  const existingManaged = (await Notifications.getAllScheduledNotificationsAsync())
    .map((request) => readManagedScheduledNotification(request))
    .filter((request): request is ManagedScheduledNotification => request !== null);
  if (!permissions.granted) {
    for (const request of existingManaged) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
    return { scheduledKinds: [] };
  }

  const desired = plan.map((item) => buildDesiredScheduledNotification(item, lang));
  const desiredByKind = new Map(desired.map((item) => [item.kind, item]));

  const existingByKind = new Map<LocalNotificationKind, ManagedScheduledNotification[]>();
  for (const request of existingManaged) {
    const requests = existingByKind.get(request.kind) ?? [];
    requests.push(request);
    existingByKind.set(request.kind, requests);
  }

  const identifiersToCancel = new Set<string>();
  const toSchedule: DesiredScheduledNotification[] = [];

  for (const [kind, requests] of existingByKind) {
    const target = desiredByKind.get(kind);
    if (!target) {
      for (const request of requests) identifiersToCancel.add(request.identifier);
      continue;
    }

    const matching = requests.filter((request) => matchesDesiredNotification(request, target));
    const keepIdentifier = matching[0]?.identifier ?? null;
    for (const request of requests) {
      if (request.identifier !== keepIdentifier) {
        identifiersToCancel.add(request.identifier);
      }
    }
    if (!keepIdentifier) {
      toSchedule.push(target);
    }
  }

  for (const item of desired) {
    if (!existingByKind.has(item.kind)) {
      toSchedule.push(item);
    }
  }

  for (const identifier of identifiersToCancel) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  const scheduledKinds: LocalNotificationKind[] = [];
  for (const item of toSchedule) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: item.identifier,
        content: {
          title: item.title,
          body: item.body,
          data: { kind: item.kind, route: item.route },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.fireAt,
          channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
        },
      });
      scheduledKinds.push(item.kind);
    } catch {
      // Best effort: keep scheduling the remaining reminders instead of aborting the batch.
    }
  }

  return { scheduledKinds };
}
