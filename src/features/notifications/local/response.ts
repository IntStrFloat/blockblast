import type * as Notifications from 'expo-notifications';

import type { LocalNotificationKind } from './planner';
import { LOCAL_NOTIFICATION_ROUTES } from './scheduler';

export interface ManagedLocalNotificationResponse {
  kind: LocalNotificationKind;
  route: string;
  responseKey: string;
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

function getResponseOccurrenceMs(response: Notifications.NotificationResponse): number | null {
  const notificationDate = response.notification.date;
  if (typeof notificationDate === 'number' && Number.isFinite(notificationDate)) {
    return notificationDate;
  }

  const trigger = response.notification.request.trigger as
    | { timestamp?: unknown; date?: unknown }
    | null
    | undefined;
  const rawTriggerDate = trigger?.timestamp ?? trigger?.date;
  if (typeof rawTriggerDate === 'number' && Number.isFinite(rawTriggerDate)) {
    return rawTriggerDate;
  }
  if (rawTriggerDate instanceof Date) return rawTriggerDate.getTime();
  return null;
}

export function getManagedLocalNotificationResponse(
  response: Notifications.NotificationResponse,
): ManagedLocalNotificationResponse | null {
  const data = response.notification.request.content.data as
    | { kind?: unknown; route?: unknown }
    | undefined;
  if (!isLocalNotificationKind(data?.kind)) return null;
  if (typeof data.route !== 'string') return null;
  const routeMatches = data.kind === 'savedRun'
    ? data.route === '/game' || data.route === '/adventure-level'
    : LOCAL_NOTIFICATION_ROUTES[data.kind] === data.route;
  if (!routeMatches) return null;
  const occurrenceMs = getResponseOccurrenceMs(response);

  return {
    kind: data.kind,
    route: data.route,
    responseKey: `${response.notification.request.identifier}:${response.actionIdentifier}:${occurrenceMs ?? 'unknown'}`,
  };
}
