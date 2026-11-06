import { KEYS, getJSON, removeKey } from '@/core/storage';

import {
  markPushSoftAskHandled,
  getPushPromptSnapshot,
  recordGameOverForPush,
  recordMeaningfulSessionForPush,
  recordFirstRecordForPush,
  shouldShowPushSoftAsk,
  recordObservedPushPermissionStatus,
} from '../softAsk';

const ELIGIBLE_CONTEXT = {
  ftueComplete: true,
  isFirstSession: false,
  permissionStatus: 'undetermined' as const,
};

describe('push soft-ask gating', () => {
  beforeEach(() => removeKey(KEYS.pushPrompt));

  it('does not turn losses into prompt eligibility', () => {
    recordGameOverForPush();
    recordGameOverForPush();
    recordGameOverForPush();
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(false);
  });

  it('requires the first record rather than a count of sessions', () => {
    recordMeaningfulSessionForPush('game-1', 'adventure');
    recordMeaningfulSessionForPush('game-2', 'adventure');
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(false);
    recordMeaningfulSessionForPush('game-3', 'adventure');
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(false);
    recordFirstRecordForPush('record-1');
    recordFirstRecordForPush('record-2');
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(true);
    expect(getPushPromptSnapshot()).toMatchObject({
      meaningfulSessions: 3,
      firstRecordRunId: 'record-1',
      lastMeaningfulMode: 'classic',
    });
  });

  it('deduplicates retries for the same meaningful session', () => {
    recordMeaningfulSessionForPush('game-1');
    recordMeaningfulSessionForPush('game-1');
    recordMeaningfulSessionForPush('game-2');
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(false);
  });

  it('waits for a record even in the first session and respects FTUE and permission', () => {
    recordMeaningfulSessionForPush('game-1');
    recordMeaningfulSessionForPush('game-2');
    recordMeaningfulSessionForPush('game-3');
    expect(shouldShowPushSoftAsk({ ...ELIGIBLE_CONTEXT, isFirstSession: true })).toBe(false);
    recordFirstRecordForPush('record-1');
    expect(shouldShowPushSoftAsk({ ...ELIGIBLE_CONTEXT, isFirstSession: true })).toBe(true);
    expect(shouldShowPushSoftAsk({ ...ELIGIBLE_CONTEXT, ftueComplete: false })).toBe(false);
    expect(
      shouldShowPushSoftAsk({ ...ELIGIBLE_CONTEXT, permissionStatus: 'granted' }),
    ).toBe(false);
    expect(shouldShowPushSoftAsk({ ...ELIGIBLE_CONTEXT, permissionStatus: 'denied' })).toBe(
      false,
    );
  });

  it('never prompts again once handled', () => {
    recordMeaningfulSessionForPush('game-1');
    markPushSoftAskHandled();
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(false);
    expect(getJSON<{ handled: boolean }>(KEYS.pushPrompt)?.handled).toBe(true);
  });

  it('detects a later OS unsubscribe without reopening the automatic ask', () => {
    expect(recordObservedPushPermissionStatus('granted')).toEqual({
      previous: null,
      unsubscribed: false,
    });
    expect(recordObservedPushPermissionStatus('denied')).toEqual({
      previous: 'granted',
      unsubscribed: true,
    });
  });
});
