import { PermissionsAndroid, Platform } from 'react-native';
import RuStorePushClient from 'react-native-rustore-push';

import { PUSH } from './config';
import { resolvePushRoute } from './routing';
import type { PushPermissionResult, PushProvider, PushTapPayload } from './types';

// Lazy singleton — constructed on first use so the NativeEventEmitter is
// only created when the native module is actually linked (not in Jest).
let _client: InstanceType<typeof RuStorePushClient> | null = null;

function getClient(): InstanceType<typeof RuStorePushClient> {
  if (!_client) {
    _client = new RuStorePushClient({
      projectId: PUSH.projectId,
      testModeEnabled: PUSH.testMode,
    });
  }
  return _client;
}

let initPromise: Promise<void> | null = null;

function reportPushError(stage: string, error: unknown): void {
  console.warn(`[push] RuStore ${stage} failed`, error);
}

async function init(): Promise<void> {
  if (PUSH.projectId === '') return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const client = getClient();
        const result = await client.init();
        if (RuStorePushClient.isError(result)) {
          reportPushError('init', result);
          initPromise = null;
          return;
        }
        if (PUSH.testMode) {
          const tokenResult = await client.getToken();
          if (!RuStorePushClient.isError(tokenResult)) {
            console.log('[push] token', tokenResult);
          }
        }
      } catch (error) {
        reportPushError('init', error);
        initPromise = null;
      }
    })();
  }
  await initPromise;
}

async function requestPermission(): Promise<PushPermissionResult> {
  if (Platform.OS !== 'android') return 'unavailable';
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
  // The RuStore SDK delivers push payloads via the 'message-received' event.
  // data is Record<string, string>; we map it to PushTapPayload for routing.
  try {
    const unsubscribe = getClient().messagingService.on(
      'message-received',
      (event: { data: Record<string, string> }) => {
        const payload: PushTapPayload = event?.data ?? {};
        handler(resolvePushRoute(payload));
      },
    );
    return () => {
      try {
        unsubscribe();
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
