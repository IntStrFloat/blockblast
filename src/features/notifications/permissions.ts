import { Platform } from 'react-native';

import { useAnalyticsStore } from '@/features/analytics';

import {
  requestLocalNotificationPermission,
} from './local/scheduler';

export type NotificationPermissionSource = 'soft_ask' | 'settings';
export type NotificationPermissionOutcome = 'granted' | 'denied' | 'unavailable' | 'error';

export interface NotificationPermissionDecision {
  local: 'granted' | 'denied' | 'error';
  remote: 'granted' | 'denied' | 'unavailable' | 'error';
  outcome: NotificationPermissionOutcome;
}

export async function requestNotificationPermissions(
  source: NotificationPermissionSource,
): Promise<NotificationPermissionDecision> {
  let local: NotificationPermissionDecision['local'] = 'denied';
  let remote: NotificationPermissionDecision['remote'] = 'unavailable';
  try {
    local = await requestLocalNotificationPermission() ? 'granted' : 'denied';
  } catch {
    local = 'error';
  }
  // Expo Notifications and RuStore both gate the same Android 13+
  // POST_NOTIFICATIONS permission. Ask the OS once and map that single result.
  remote = Platform.OS === 'android'
    ? local
    : local === 'error'
      ? 'error'
      : 'unavailable';
  const outcome: NotificationPermissionOutcome =
    local === 'granted' || remote === 'granted'
      ? 'granted'
      : local === 'error' || remote === 'error'
        ? 'error'
        : Platform.OS === 'web'
          ? 'unavailable'
          : 'denied';
  useAnalyticsStore.getState().track('notification_permission_result', {
    source,
    local,
    remote,
    outcome,
  });
  return { local, remote, outcome };
}
