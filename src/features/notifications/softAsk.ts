import { KEYS, getJSON, setJSON } from '@/core/storage';

export type PushPermissionStatus = 'undetermined' | 'granted' | 'denied';

interface PushPromptState {
  /** Retained only to migrate installs that already persisted the v1 shape. */
  gameOvers: number;
  meaningfulSessions: number;
  handled: boolean;
  firstRecordRunId?: string;
  lastMeaningfulSessionId?: string;
  lastMeaningfulMode?: 'classic' | 'adventure';
  lastObservedPermissionStatus?: PushPermissionStatus;
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

function load(): PushPromptState {
  const persisted = getJSON<Partial<PushPromptState>>(KEYS.pushPrompt);
  return {
    ...EMPTY,
    ...persisted,
    gameOvers: Math.max(0, persisted?.gameOvers ?? 0),
    meaningfulSessions: Math.max(0, persisted?.meaningfulSessions ?? 0),
    handled: persisted?.handled ?? false,
    lastObservedPermissionStatus: persisted?.lastObservedPermissionStatus,
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
export function recordMeaningfulSessionForPush(
  sessionId: string,
  mode: 'classic' | 'adventure' = 'classic',
): void {
  const state = load();
  if (state.handled || !sessionId || state.lastMeaningfulSessionId === sessionId) return;
  setJSON(KEYS.pushPrompt, {
    ...state,
    meaningfulSessions: state.meaningfulSessions + 1,
    lastMeaningfulSessionId: sessionId,
    lastMeaningfulMode: mode,
  });
}

/** A score record is the single positive trigger in the Night Candy flow. */
export function recordFirstRecordForPush(runId: string): void {
  const state = load();
  if (state.handled || state.firstRecordRunId || !runId) return;
  setJSON(KEYS.pushPrompt, { ...state, firstRecordRunId: runId, lastMeaningfulMode: 'classic' });
}

/** The OS permission request still needs the player's explicit Allow tap. */
export function shouldShowPushSoftAsk(context: PushSoftAskContext): boolean {
  const state = load();
  return (
    !state.handled &&
    context.ftueComplete &&
    context.permissionStatus === 'undetermined' &&
    Boolean(state.firstRecordRunId)
  );
}

/** Player chose allow/later: the soft-ask is intentionally single-shot. */
export function markPushSoftAskHandled(): void {
  setJSON(KEYS.pushPrompt, { ...load(), handled: true });
}

export function getPushPromptSnapshot(): Readonly<PushPromptState> {
  return load();
}

export function recordObservedPushPermissionStatus(
  status: PushPermissionStatus,
): { previous: PushPermissionStatus | null; unsubscribed: boolean } {
  const state = load();
  const previous = state.lastObservedPermissionStatus ?? null;
  setJSON(KEYS.pushPrompt, { ...state, lastObservedPermissionStatus: status });
  return {
    previous,
    unsubscribed: previous === 'granted' && status === 'denied',
  };
}
