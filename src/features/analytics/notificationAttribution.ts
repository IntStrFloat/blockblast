import { KEYS, getJSON, removeKey, setJSON } from '@/core/storage';

import { useAnalyticsStore } from './store';

interface NotificationAttribution {
  attributionId: string;
  kind: string;
  route: string;
  openedAt: number;
  targetViewedAt: number | null;
}

const ATTRIBUTION_TTL_MS = 24 * 60 * 60 * 1000;

function currentAttribution(now = Date.now()): NotificationAttribution | null {
  const value = getJSON<NotificationAttribution>(KEYS.analyticsNotificationAttribution);
  if (!value || now - value.openedAt > ATTRIBUTION_TTL_MS) {
    removeKey(KEYS.analyticsNotificationAttribution);
    return null;
  }
  return value;
}

export function recordNotificationAttribution(input: {
  attributionId: string;
  kind: string;
  route: string;
  openedAt?: number;
}): void {
  if (useAnalyticsStore.getState().optOut) return;
  setJSON(KEYS.analyticsNotificationAttribution, {
    attributionId: input.attributionId,
    kind: input.kind,
    route: input.route,
    openedAt: input.openedAt ?? Date.now(),
    targetViewedAt: null,
  } satisfies NotificationAttribution);
}

export function recordNotificationTargetViewed(route: string, now = Date.now()): void {
  const pending = currentAttribution(now);
  if (!pending || pending.route !== route || pending.targetViewedAt !== null) return;
  useAnalyticsStore.getState().trackOnce(
    `notification-target:${pending.attributionId}`,
    'notification_target_viewed',
    {
      attribution_id: pending.attributionId,
      kind: pending.kind,
      route,
      elapsed_ms: Math.max(0, now - pending.openedAt),
    },
  );
  setJSON(KEYS.analyticsNotificationAttribution, { ...pending, targetViewedAt: now });
}

export function recordNotificationTargetAction(action: string, now = Date.now()): void {
  const pending = currentAttribution(now);
  if (!pending || pending.targetViewedAt === null) return;
  useAnalyticsStore.getState().trackOnce(
    `notification-action:${pending.attributionId}:${action}`,
    'notification_target_action',
    {
      attribution_id: pending.attributionId,
      kind: pending.kind,
      action,
      elapsed_ms: Math.max(0, now - pending.openedAt),
    },
  );
  removeKey(KEYS.analyticsNotificationAttribution);
}
