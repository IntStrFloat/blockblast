import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

import type { AnalyticsEntrySource } from '@/features/analytics';

import { getManagedLocalNotificationResponse, type ManagedLocalNotificationResponse } from './local/response';
import { getPush } from './provider';
import type { PushNotificationTap } from './types';

export interface InitialSessionIntent {
  source: AnalyticsEntrySource;
  remoteTap: PushNotificationTap | null;
  localTap: ManagedLocalNotificationResponse | null;
}

let initialSessionIntentPromise: Promise<InitialSessionIntent> | null = null;

export function getInitialSessionIntent(): Promise<InitialSessionIntent> {
  if (initialSessionIntentPromise) return initialSessionIntentPromise;

  const push = getPush();
  initialSessionIntentPromise = Promise.all([
    push.getInitialNotificationTap().catch(() => null),
    Notifications.getLastNotificationResponseAsync().catch(() => null),
    Linking.getInitialURL().catch(() => null),
  ]).then(([remoteTap, localResponse, initialUrl]) => {
    const localTap = localResponse
      ? getManagedLocalNotificationResponse(localResponse)
      : null;
    if (remoteTap) return { source: 'notification', remoteTap, localTap: null };
    if (localTap) return { source: 'notification', remoteTap: null, localTap };
    if (initialUrl) return { source: 'deeplink', remoteTap: null, localTap: null };
    return { source: 'organic', remoteTap: null, localTap: null };
  });

  return initialSessionIntentPromise;
}

/** Только для изоляции Jest-монтов; процесс приложения получает один startup intent. */
export function resetInitialSessionIntentForTests(): void {
  initialSessionIntentPromise = null;
}
