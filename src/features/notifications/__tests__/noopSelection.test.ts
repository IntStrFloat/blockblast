import { getPush } from '../index';
import { NoopPushProvider } from '../noop';

describe('push provider selection (web/test)', () => {
  it('returns NoopPushProvider under jest (rustorePush.ts resolves to Noop)', () => {
    expect(getPush()).toBe(NoopPushProvider);
  });

  it('NoopPushProvider reports unavailable and no-ops', async () => {
    await expect(NoopPushProvider.init()).resolves.toBeUndefined();
    await expect(NoopPushProvider.requestPermission()).resolves.toBe('unavailable');
    const unsubscribe = NoopPushProvider.onNotificationTap(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
