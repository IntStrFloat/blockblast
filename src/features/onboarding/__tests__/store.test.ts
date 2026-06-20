import { KEYS, getJSON, removeKey } from '@/core/storage';

import { shouldShowOnboarding, useOnboarding } from '../store';

beforeEach(() => {
  removeKey(KEYS.onboardingMeta);
  useOnboarding.setState({ seen: false });
});

describe('shouldShowOnboarding', () => {
  it('shows only until it has been seen', () => {
    expect(shouldShowOnboarding(false)).toBe(true);
    expect(shouldShowOnboarding(true)).toBe(false);
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
