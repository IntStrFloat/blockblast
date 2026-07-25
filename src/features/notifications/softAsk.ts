import { KEYS, getJSON, setJSON } from '@/core/storage';

export type PushPermissionStatus = 'undetermined' | 'granted' | 'denied';

interface PushPromptState {
  /** Retained only to migrate installs that already persisted the v1 shape. */
  gameOvers: number;
  meaningfulSessions: number;
  handled: boolean;
  lastMeaningfulSessionId?: string;
}

export interface PushSoftAskContext {
  ftueComplete: boolean;
  isFirstSession: boolean;
  permissionStatus: PushPermissionStatus;
}

const EMPTY: PushPromptState = {
  gameOvers: 0,
  meaningfulSessions: 0,
  handled: false,
};
const MIN_MEANINGFUL_SESSIONS = 3;

function load(): PushPromptState {
  const persisted = getJSON<Partial<PushPromptState>>(KEYS.pushPrompt);
  return {
    ...EMPTY,
    ...persisted,
    gameOvers: Math.max(0, persisted?.gameOvers ?? 0),
    meaningfulSessions: Math.max(0, persisted?.meaningfulSessions ?? 0),
    handled: persisted?.handled ?? false,
  };
}

/** Legacy telemetry hook. A loss is no longer positive-value eligibility. */
export function recordGameOverForPush(): void {
  const state = load();
  if (state.handled) return;
  setJSON(KEYS.pushPrompt, { ...state, gameOvers: state.gameOvers + 1 });
}

/**
 * Records one completed value-bearing game/session (for example daily
 * activation or an Adventure win). The id makes retries idempotent.
 */
export function recordMeaningfulSessionForPush(sessionId: string): void {
  const state = load();
  if (state.handled || !sessionId || state.lastMeaningfulSessionId === sessionId) return;
  setJSON(KEYS.pushPrompt, {
    ...state,
    meaningfulSessions: state.meaningfulSessions + 1,
    lastMeaningfulSessionId: sessionId,
  });
}

/** Soft-ask is allowed only after repeated value, outside the first session. */
export function shouldShowPushSoftAsk(context: PushSoftAskContext): boolean {
  const state = load();
  return (
    !state.handled &&
    context.ftueComplete &&
    !context.isFirstSession &&
    context.permissionStatus === 'undetermined' &&
    state.meaningfulSessions >= MIN_MEANINGFUL_SESSIONS
  );
}

/** Player chose allow/later: the soft-ask is intentionally single-shot. */
export function markPushSoftAskHandled(): void {
  setJSON(KEYS.pushPrompt, { ...load(), handled: true });
}
