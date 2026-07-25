/**
 * @deprecated Mount HomePromptHost from Home with explicit overlay/session
 * context. Keeping this no-op export prevents an old root mount from racing
 * with the coordinated host during migration.
 */
export function PushSoftAskSheet() {
  return null;
}
