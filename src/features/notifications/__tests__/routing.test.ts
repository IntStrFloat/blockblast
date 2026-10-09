import { resolveNotificationTargetRoute, resolvePushRoute } from '../routing';

describe('resolvePushRoute', () => {
  it('returns Home for empty/undefined payload', () => {
    expect(resolvePushRoute(undefined)).toBe('/');
    expect(resolvePushRoute({})).toBe('/');
  });

  it('returns Home when route is missing or not a string', () => {
    expect(resolvePushRoute({ route: 42 as unknown as string })).toBe('/');
  });

  it('passes through known in-app routes', () => {
    expect(resolvePushRoute({ route: '/adventure' })).toBe('/adventure');
    expect(resolvePushRoute({ route: '/leaderboard' })).toBe('/leaderboard');
    expect(resolvePushRoute({ route: '/map' })).toBe('/map');
    expect(resolvePushRoute({ route: '/adventure-level' })).toBe('/adventure-level');
  });

  it('falls back to Home for unknown or unsafe routes', () => {
    expect(resolvePushRoute({ route: 'https://evil.example' })).toBe('/');
    expect(resolvePushRoute({ route: '/does-not-exist' })).toBe('/');
  });
});

describe('resolveNotificationTargetRoute', () => {
  it('resumes an available Classic or Adventure checkpoint', () => {
    expect(resolveNotificationTargetRoute('/game', {
      classicCanContinue: true,
      adventureKind: 'none',
    })).toBe('/game');
    expect(resolveNotificationTargetRoute('/adventure-level', {
      classicCanContinue: false,
      adventureKind: 'active',
    })).toBe('/adventure-level');
  });

  it('falls back when the notified goal was already completed or removed', () => {
    expect(resolveNotificationTargetRoute('/game', {
      classicCanContinue: false,
      adventureKind: 'none',
    })).toBe('/');
    expect(resolveNotificationTargetRoute('/adventure-level', {
      classicCanContinue: false,
      adventureKind: 'none',
    })).toBe('/adventure');
  });
});
