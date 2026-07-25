import { KEYS, getJSON, removeKey } from '@/core/storage';

import { useWelcomePromptStore } from '../welcomePromptStore';

describe('welcome notification prompt gate', () => {
  beforeEach(() => {
    removeKey(KEYS.onboardingWelcomePrompt);
    useWelcomePromptStore.setState({ resolved: false });
  });

  it('releases onboarding and persists the notification prompt decision', () => {
    useWelcomePromptStore.getState().resolve();

    expect(useWelcomePromptStore.getState().resolved).toBe(true);
    expect(getJSON<{ resolved?: boolean }>(KEYS.onboardingWelcomePrompt)).toEqual({
      resolved: true,
    });
  });
});
