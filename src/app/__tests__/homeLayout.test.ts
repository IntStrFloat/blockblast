declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('home screen layout', () => {
  const source = fs.readFileSync(`${__dirname}/../index.tsx`, 'utf8');

  it('keeps the header and main content scrollable without a Home ad banner', () => {
    expect(source).toContain('ScrollView');
    expect(source).toContain('contentContainerStyle');
    expect(source).not.toContain('<AdBanner');
    expect(source).not.toContain("from '@/features/monetization'");
  });

  it('mounts the progressive next-action card on Home instead of the first-launch push overlay', () => {
    expect(source).toContain('selectNextAction({');
    expect(source).toContain('<NextActionCard');
    expect(source).not.toContain('<WelcomeNotificationOverlay');
  });

  it('shows a compact streak recovery CTA without replacing the main classic CTA', () => {
    expect(source).toContain('<StreakStatusCard');
    expect(source).toContain("t('home.streakKeep', lang)");
    expect(source).toContain("t('home.streakRecover', lang)");
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('onPress={play}');
    expect(source).toContain('testID="home-menu-classic"');
  });
});
