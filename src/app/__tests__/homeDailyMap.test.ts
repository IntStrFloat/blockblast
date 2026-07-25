declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

const read = (relativePath: string) => fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

describe('home mode hierarchy + secondary navigation', () => {
  const home = read('../index.tsx');
  const gameButton = read('../../ui/primitives/GameButton.tsx');

  it('keeps the reference-style menu to two prominent modes with a season ribbon', () => {
    expect(home).toContain('ReferenceMenuButton');
    expect(home).toContain('home-menu-classic');
    expect(home).toContain('home-menu-adventure');
    expect(home).toContain('<SeasonCountdownBadge compact short variant="ribbon" />');
  });

  it('keeps map and weekly leaderboard as quiet links below the two modes', () => {
    expect(home).toContain('quickLinks');
    expect(home).toContain("router.push('/map')");
    expect(home).toContain("router.push('/leaderboard')");
    expect(home).toContain("t('home.levels', lang)");
  });

  it('surfaces current world and level in the secondary progress shortcut', () => {
    expect(home).toContain('useProgression');
    expect(home).toContain("progressionText('world', lang)");
    expect(home).toContain("progressionText('lvlShort', lang)");
  });

  it('removes Daily challenge and Daily bonus from the Home loop', () => {
    expect(home).not.toContain('createDailyChallenge');
    expect(home).not.toContain('shouldShowDailyChallenge');
    expect(home).not.toContain('useDailyBonus');
    expect(home).not.toContain("entry: 'daily'");
    expect(home).not.toContain('confirmDaily');
    expect(home).not.toContain('Daily');
  });

  it('keeps secondary buttons opaque so background art cannot show through as stripes', () => {
    expect(gameButton).toContain('ghost: {');
    expect(gameButton).toContain('backgroundColor: colors.cardSolid');
    expect(gameButton).toContain('overflow: \'hidden\'');
    expect(gameButton).not.toContain('ghost: { backgroundColor: colors.surface }');
  });
});
