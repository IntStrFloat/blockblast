import type { PushProvider } from './types';

export const NoopPushProvider: PushProvider = {
  async init() {},
  async requestPermission() {
    return 'unavailable';
  },
  onNotificationTap() {
    return () => {};
  },
};
