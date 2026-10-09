import { Platform } from 'react-native';

import { requestNotificationPermissions } from '../permissions';

const mockTrack = jest.fn();
const mockRequestLocal = jest.fn();

jest.mock('@/features/analytics', () => ({
  useAnalyticsStore: {
    getState: () => ({ track: mockTrack }),
  },
}));
jest.mock('../local/scheduler', () => ({
  requestLocalNotificationPermission: () => mockRequestLocal(),
}));

describe('notification permission decisions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps soft acceptance separate from a granted OS result', async () => {
    mockRequestLocal.mockResolvedValue(true);

    await expect(requestNotificationPermissions('soft_ask')).resolves.toEqual({
      local: 'granted',
      remote: Platform.OS === 'android' ? 'granted' : 'unavailable',
      outcome: 'granted',
    });
    expect(mockTrack).toHaveBeenCalledWith('notification_permission_result', {
      source: 'soft_ask',
      local: 'granted',
      remote: Platform.OS === 'android' ? 'granted' : 'unavailable',
      outcome: 'granted',
    });
    expect(mockRequestLocal).toHaveBeenCalledTimes(1);
  });

  it('records denial from both permission surfaces', async () => {
    mockRequestLocal.mockResolvedValue(false);
    await expect(requestNotificationPermissions('settings')).resolves.toMatchObject({
      local: 'denied',
      remote: Platform.OS === 'android' ? 'denied' : 'unavailable',
      outcome: 'denied',
    });
    expect(mockRequestLocal).toHaveBeenCalledTimes(1);
  });

  it('records API errors explicitly instead of calling them denied or granted', async () => {
    mockRequestLocal.mockRejectedValue(new Error('local failure'));
    await expect(requestNotificationPermissions('soft_ask')).resolves.toEqual({
      local: 'error',
      remote: 'error',
      outcome: 'error',
    });
    expect(mockRequestLocal).toHaveBeenCalledTimes(1);
  });
});
