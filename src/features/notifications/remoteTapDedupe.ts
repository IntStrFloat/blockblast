import type { PushNotificationTap } from './types';

const IDLESS_TAP_DEDUPE_MS = 2_000;

export interface RemoteTapDedupeState {
  ids: Set<string>;
  idlessSeenAt: Map<string, number>;
}

export function createRemoteTapDedupeState(): RemoteTapDedupeState {
  return { ids: new Set(), idlessSeenAt: new Map() };
}

export function shouldHandleRemoteTap(
  tap: PushNotificationTap,
  state: RemoteTapDedupeState,
  now = Date.now(),
): boolean {
  if (tap.id) {
    if (state.ids.has(tap.id)) return false;
    state.ids.add(tap.id);
    return true;
  }

  for (const [key, seenAt] of state.idlessSeenAt) {
    if (now - seenAt > IDLESS_TAP_DEDUPE_MS) state.idlessSeenAt.delete(key);
  }
  const fallbackKey = `${tap.kind}:${tap.route}`;
  const previousSeenAt = state.idlessSeenAt.get(fallbackKey);
  if (previousSeenAt !== undefined && now - previousSeenAt <= IDLESS_TAP_DEDUPE_MS) {
    return false;
  }
  state.idlessSeenAt.set(fallbackKey, now);
  return true;
}
