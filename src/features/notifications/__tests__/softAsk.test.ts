import { KEYS, getJSON, removeKey } from '@/core/storage';

import {
  recordGameOverForPush,
  shouldShowPushSoftAsk,
  markPushSoftAskHandled,
} from '../softAsk';

describe('push soft-ask gating', () => {
  beforeEach(() => removeKey(KEYS.pushPrompt));

  it('does not prompt before the first game over', () => {
    expect(shouldShowPushSoftAsk()).toBe(false);
  });

  it('prompts after the first recorded game over', () => {
    recordGameOverForPush();
    expect(shouldShowPushSoftAsk()).toBe(true);
  });

  it('never prompts again once handled', () => {
    recordGameOverForPush();
    markPushSoftAskHandled();
    expect(shouldShowPushSoftAsk()).toBe(false);
    recordGameOverForPush();
    expect(shouldShowPushSoftAsk()).toBe(false);
  });

  it('persists handled flag via MMKV', () => {
    recordGameOverForPush();
    markPushSoftAskHandled();
    expect(getJSON<{ handled: boolean }>(KEYS.pushPrompt)?.handled).toBe(true);
  });
});
