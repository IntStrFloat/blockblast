import type { PushTapPayload } from './types';

/** Белый список маршрутов, на которые можно вести по тапу пуша. */
const ALLOWED_ROUTES = new Set<string>(['/', '/leaderboard', '/map', '/settings', '/game']);

const HOME = '/';

/** Санитизирует payload пуша в безопасный внутренний маршрут expo-router. */
export function resolvePushRoute(payload: PushTapPayload | undefined): string {
  const route = payload?.route;
  if (typeof route !== 'string') return HOME;
  return ALLOWED_ROUTES.has(route) ? route : HOME;
}
