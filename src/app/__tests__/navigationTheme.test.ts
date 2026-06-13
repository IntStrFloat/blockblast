import { appNavigationTheme } from '@/ui/navigationTheme';

describe('appNavigationTheme', () => {
  it('does not paint the navigator white over the app gradient', () => {
    expect(appNavigationTheme.dark).toBe(true);
    expect(appNavigationTheme.colors.background).toBe('transparent');
    expect(appNavigationTheme.colors.card).toBe('transparent');
  });
});
