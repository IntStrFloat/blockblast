import { PermissionsAndroid, Platform } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- GitFlic-пакет без node-entry, типы в rustore-push.d.ts
import RustorePushClient, { eventEmitter, PushEvents } from 'react-native-rustore-push';
import type { RemoteMessage } from 'react-native-rustore-push';

import { PUSH } from './config';
import { requestAndroidPushPermission } from './rustorePermission';
import { resolvePushRoute } from './routing';
import type { PushNotificationTap, PushPermissionResult, PushProvider } from './types';

// RuStore Push SDK 6.x инициализируется автоматически из manifest meta-data
// `ru.rustore.sdk.pushclient.project_id` (его проставляет plugins/withRuStorePush.js).
// JS-вызова init нет; нам нужно лишь поднять эмиттер событий и подписаться на тап.

let emitterReady = false;

function reportPushError(stage: string, error: unknown): void {
  console.warn(`[push] RuStore ${stage} failed`, error);
}

function ensureEmitter(): void {
  if (emitterReady) return;
  RustorePushClient.createPushEmitter();
  emitterReady = true;
}

/** Достаёт безопасный внутренний маршрут из пуша (deep-link или data.key==='route'). */
function routeFromMessage(message: RemoteMessage | null): string {
  if (!message) return resolvePushRoute(undefined);
  const { notification, data } = message;
  let route: string | undefined;
  if (notification?.clickActionType === 'DEEP_LINK' && notification.clickAction) {
    route = notification.clickAction;
  } else if (data?.key === 'route') {
    route = data.value;
  }
  return resolvePushRoute({ route });
}

function tapFromMessage(message: RemoteMessage | null): PushNotificationTap | null {
  if (!message) return null;
  const kind =
    message.data?.key === 'kind' && message.data.value.trim() !== ''
      ? message.data.value
      : 'unknown';
  return { id: message.messageId ?? null, route: routeFromMessage(message), kind };
}

async function init(): Promise<void> {
  if (PUSH.projectId === '') return;
  try {
    ensureEmitter();
    if (PUSH.testMode) {
      const available = await RustorePushClient.checkPushAvailability();
      console.log('[push] availability', available);
    }
  } catch (error) {
    reportPushError('init', error);
  }
}

async function requestPermission(): Promise<PushPermissionResult> {
  return requestAndroidPushPermission({
    platform: Platform.OS,
    version: Platform.Version,
    grantedValue: PermissionsAndroid.RESULTS.GRANTED,
    request: () => PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ),
    onError: (error) => reportPushError('permission', error),
  });
}

async function getInitialNotificationTap(): Promise<PushNotificationTap | null> {
  if (PUSH.projectId === '') return null;
  try {
    ensureEmitter();
    return tapFromMessage(await RustorePushClient.getInitialNotification());
  } catch (error) {
    reportPushError('getInitialNotification', error);
    return null;
  }
}

function onNotificationTap(handler: (tap: PushNotificationTap) => void): () => void {
  try {
    ensureEmitter();
    const subscription = eventEmitter.addListener(
      PushEvents.ON_OPENED,
      (message: RemoteMessage) => {
        const tap = tapFromMessage(message);
        if (tap) handler(tap);
      },
    );
    return () => {
      try {
        subscription.remove();
      } catch (error) {
        reportPushError('unsubscribe', error);
      }
    };
  } catch (error) {
    reportPushError('tap subscription', error);
    return () => {};
  }
}

export const RuStorePushProvider: PushProvider = {
  init,
  requestPermission,
  getInitialNotificationTap,
  onNotificationTap,
};
