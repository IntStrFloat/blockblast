import type { PushTapPayload } from './types';

/** Белый список маршрутов, на которые можно вести по тапу пуша. */
const ALLOWED_ROUTES = new Set<string>([
  '/',
  '/adventure',
  '/leaderboard',
  '/map',
  '/settings',
  '/game',
  '/adventure-level',
]);

const HOME = '/';

/** Санитизирует payload пуша в безопасный внутренний маршрут expo-router. */
export function resolvePushRoute(payload: PushTapPayload | undefined): string {
  const route = payload?.route;
  if (typeof route !== 'string') return HOME;
  return ALLOWED_ROUTES.has(route) ? route : HOME;
}

export function resolveNotificationTargetRoute(
  route: string,
  state: {
    classicCanContinue: boolean;
    adventureKind: 'none' | 'active' | 'terminal';
  },
): string {
  if (route === '/game' && !state.classicCanContinue) return HOME;
  if (route === '/adventure-level' && state.adventureKind === 'none') return '/adventure';
  return ALLOWED_ROUTES.has(route) ? route : HOME;
}
