import { resolvePushRoute } from '../routing';

describe('resolvePushRoute', () => {
  it('returns Home for empty/undefined payload', () => {
    expect(resolvePushRoute(undefined)).toBe('/');
    expect(resolvePushRoute({})).toBe('/');
  });

  it('returns Home when route is missing or not a string', () => {
    expect(resolvePushRoute({ route: 42 as unknown as string })).toBe('/');
  });

  it('passes through known in-app routes', () => {
    expect(resolvePushRoute({ route: '/leaderboard' })).toBe('/leaderboard');
    expect(resolvePushRoute({ route: '/map' })).toBe('/map');
  });

  it('falls back to Home for unknown or unsafe routes', () => {
    expect(resolvePushRoute({ route: 'https://evil.example' })).toBe('/');
    expect(resolvePushRoute({ route: '/does-not-exist' })).toBe('/');
  });
});
