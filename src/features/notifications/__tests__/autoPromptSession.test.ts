import {
  claimAutoPrompt,
  getClaimedAutoPrompt,
  resetAutoPromptSessionForTests,
} from '../autoPromptSession';

const CLEAR = { blockingOverlayVisible: false, userDialogOpen: false };

describe('auto prompt session coordination', () => {
  beforeEach(resetAutoPromptSessionForTests);

  it('allows no more than one automatic prompt in an app session', () => {
    expect(claimAutoPrompt('notifications', CLEAR)).toBe(true);
    expect(claimAutoPrompt('review', CLEAR)).toBe(false);
    expect(getClaimedAutoPrompt()).toBe('notifications');
  });

  it('does not claim while a user dialog or blocking overlay is active', () => {
    expect(claimAutoPrompt('notifications', { ...CLEAR, userDialogOpen: true })).toBe(false);
    expect(
      claimAutoPrompt('notifications', { ...CLEAR, blockingOverlayVisible: true }),
    ).toBe(false);
    expect(getClaimedAutoPrompt()).toBeNull();
  });
});
