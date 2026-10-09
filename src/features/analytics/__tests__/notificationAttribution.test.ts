import { KEYS, getJSON, removeKey } from '@/core/storage';

import {
  recordNotificationAttribution,
  recordNotificationTargetAction,
  recordNotificationTargetViewed,
} from '../notificationAttribution';
import { useAnalyticsStore } from '../store';

describe('notification attribution', () => {
  beforeEach(() => {
    removeKey(KEYS.analyticsNotificationAttribution);
    useAnalyticsStore.setState({ optOut: false });
  });

  it('links notification open to target screen and first meaningful action', () => {
    const trackOnce = jest.spyOn(useAnalyticsStore.getState(), 'trackOnce');
    recordNotificationAttribution({
      attributionId: 'notification-1',
      kind: 'seasonEnding',
      route: '/adventure',
      openedAt: 1_000,
    });

    recordNotificationTargetViewed('/adventure', 1_500);
    recordNotificationTargetAction('start_adventure_level', 2_000);
    recordNotificationTargetAction('start_adventure_level', 2_500);

    expect(trackOnce).toHaveBeenCalledWith(
      'notification-target:notification-1',
      'notification_target_viewed',
      expect.objectContaining({ attribution_id: 'notification-1', elapsed_ms: 500 }),
    );
    expect(trackOnce).toHaveBeenCalledWith(
      'notification-action:notification-1:start_adventure_level',
      'notification_target_action',
      expect.objectContaining({ attribution_id: 'notification-1', elapsed_ms: 1_000 }),
    );
    expect(getJSON(KEYS.analyticsNotificationAttribution)).toBeNull();
    trackOnce.mockRestore();
  });

  it('does not persist attribution after analytics opt-out', () => {
    useAnalyticsStore.setState({ optOut: true });
    recordNotificationAttribution({
      attributionId: 'notification-opt-out',
      kind: 'streak',
      route: '/',
    });
    expect(getJSON(KEYS.analyticsNotificationAttribution)).toBeNull();
  });
});
