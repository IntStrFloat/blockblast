import { requestAndroidPushPermission } from '../rustorePermission';

describe('RuStore push permission', () => {
  it('keeps a native API exception distinct from a user denial', async () => {
    const onError = jest.fn();
    const request = jest.fn().mockRejectedValue(new Error('native permission failure'));
    await expect(requestAndroidPushPermission({
      platform: 'android',
      version: 33,
      grantedValue: 'granted',
      request,
      onError,
    })).resolves.toBe('error');
    expect(request).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('asks once and distinguishes grant from denial on Android 13+', async () => {
    const granted = jest.fn().mockResolvedValue('granted');
    await expect(requestAndroidPushPermission({
      platform: 'android',
      version: 33,
      grantedValue: 'granted',
      request: granted,
    })).resolves.toBe('granted');
    expect(granted).toHaveBeenCalledTimes(1);

    const denied = jest.fn().mockResolvedValue('denied');
    await expect(requestAndroidPushPermission({
      platform: 'android',
      version: 34,
      grantedValue: 'granted',
      request: denied,
    })).resolves.toBe('denied');
    expect(denied).toHaveBeenCalledTimes(1);
  });

  it('does not ask on pre-13 Android or unsupported platforms', async () => {
    const request = jest.fn();
    await expect(requestAndroidPushPermission({
      platform: 'android',
      version: 32,
      grantedValue: 'granted',
      request,
    })).resolves.toBe('granted');
    await expect(requestAndroidPushPermission({
      platform: 'ios',
      version: '17',
      grantedValue: 'granted',
      request,
    })).resolves.toBe('unavailable');
    expect(request).not.toHaveBeenCalled();
  });
});
