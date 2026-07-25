import { KEYS, getJSON, removeKey } from '@/core/storage';

import {
  markPushSoftAskHandled,
  recordGameOverForPush,
  recordMeaningfulSessionForPush,
  shouldShowPushSoftAsk,
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
    recordMeaningfulSessionForPush('game-1');
    recordMeaningfulSessionForPush('game-2');
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(false);
    recordMeaningfulSessionForPush('game-3');
    expect(shouldShowPushSoftAsk(ELIGIBLE_CONTEXT)).toBe(true);
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
});
