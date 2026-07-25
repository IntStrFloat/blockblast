import { KEYS, getJSON, removeKey } from '@/core/storage';

import { shouldShowOnboarding, useOnboarding } from '../store';

beforeEach(() => {
  removeKey(KEYS.onboardingMeta);
  useOnboarding.setState({ seen: false });
});

describe('shouldShowOnboarding', () => {
  it('shows only until it has been seen, and only after the first game', () => {
    expect(shouldShowOnboarding(false, 1)).toBe(true);
    expect(shouldShowOnboarding(true, 1)).toBe(false);
  });

  it('is hidden for brand-new installs until they finish a game', () => {
    expect(shouldShowOnboarding(false, 0)).toBe(false);
    expect(shouldShowOnboarding(false, 2)).toBe(true);
  });
});

describe('useOnboarding.markSeen', () => {
  it('flips seen and persists it so the onboarding never repeats', () => {
    expect(useOnboarding.getState().seen).toBe(false);

    useOnboarding.getState().markSeen();

    expect(useOnboarding.getState().seen).toBe(true);
    expect(getJSON<{ seen: boolean }>(KEYS.onboardingMeta)).toEqual({ seen: true });
  });
});
