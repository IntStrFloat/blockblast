import { KEYS, getJSON, removeKey } from '@/core/storage';

import {
  markPushSoftAskHandled,
  getPushPromptSnapshot,
  recordGameOverForPush,
  recordMeaningfulSessionForPush,
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

  it('becomes eligible after three distinct meaningful sessions', () => {
    recordMeaningfulSessionForPush('game-1', 'adventure');
    recordMeaningfulSessionForPush('game-2', 'adventure');
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(false);
    recordMeaningfulSessionForPush('game-3', 'adventure');
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(true);
    expect(getPushPromptSnapshot()).toMatchObject({
      meaningfulSessions: 3,
      lastMeaningfulMode: 'adventure',
    });
  });

  it('deduplicates retries for the same meaningful session', () => {
    recordMeaningfulSessionForPush('game-1');
    recordMeaningfulSessionForPush('game-1');
    recordMeaningfulSessionForPush('game-2');
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(false);
  });

  it('blocks first-session, incomplete-FTUE and decided-permission contexts', () => {
    recordMeaningfulSessionForPush('game-1');
    recordMeaningfulSessionForPush('game-2');
    recordMeaningfulSessionForPush('game-3');
    expect(shouldShowPushSoftAsk({ ...ELIGIBLE_CONTEXT, isFirstSession: true })).toBe(false);
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
