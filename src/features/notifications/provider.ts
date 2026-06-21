import { PUSH } from './config';
import { NoopPushProvider } from './noop';
import { RuStorePushProvider } from './rustorePush';
import type { PushProvider } from './types';

export function getPush(): PushProvider {
  if (PUSH.pushEnabled && PUSH.projectId !== '') {
    return RuStorePushProvider; // На native резолвится rustorePush.native.ts
  }
  return NoopPushProvider;
}
