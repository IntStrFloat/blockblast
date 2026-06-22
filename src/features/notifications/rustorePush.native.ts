import { PermissionsAndroid, Platform } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- GitFlic-пакет без node-entry, типы в rustore-push.d.ts
import RustorePushClient, { eventEmitter, PushEvents } from 'react-native-rustore-push';
// eslint-disable-next-line import/no-unresolved -- см. выше
import type { RemoteMessage } from 'react-native-rustore-push';

import { PUSH } from './config';
import { resolvePushRoute } from './routing';
import type { PushPermissionResult, PushProvider } from './types';

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
  if (Platform.OS !== 'android') return 'unavailable';
  // Android < 13 не требует runtime-разрешения уведомлений.
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return 'granted';
  try {
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return status === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
  } catch (error) {
    reportPushError('permission', error);
    return 'denied';
  }
}

function onNotificationTap(handler: (route: string) => void): () => void {
  try {
    ensureEmitter();
    // Тап по пушу, когда приложение в foreground.
    const subscription = eventEmitter.addListener(
      PushEvents.ON_OPENED,
      (message: RemoteMessage) => handler(routeFromMessage(message)),
    );
    // Приложение открыто тапом по пушу из фона/холодного старта.
    RustorePushClient.getInitialNotification()
      .then((message) => {
        if (message) handler(routeFromMessage(message));
      })
      .catch((error) => reportPushError('getInitialNotification', error));
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
  onNotificationTap,
};
