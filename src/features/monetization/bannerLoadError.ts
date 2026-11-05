/** Android wraps errors in `error`; iOS emits the fields directly. */
export function bannerLoadErrorMessage(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const event = payload as Record<string, unknown>;
  const error = typeof event.error === 'object' && event.error !== null
    ? event.error as Record<string, unknown>
    : event;
  if (typeof error.description !== 'string') return undefined;
  return typeof error.code === 'number' || typeof error.code === 'string'
    ? `${error.code}: ${error.description}`
    : error.description;
}
