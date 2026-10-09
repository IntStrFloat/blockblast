import type { PushPermissionResult } from './types';

export async function requestAndroidPushPermission(input: {
  platform: string;
  version: string | number;
  grantedValue: string;
  request: () => Promise<string>;
  onError?: (error: unknown) => void;
}): Promise<PushPermissionResult> {
  if (input.platform !== 'android') return 'unavailable';
  if (typeof input.version === 'number' && input.version < 33) return 'granted';
  try {
    return await input.request() === input.grantedValue ? 'granted' : 'denied';
  } catch (error) {
    input.onError?.(error);
    return 'error';
  }
}

