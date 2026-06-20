declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

const read = (relativePath: string) => fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

describe('world theme drives the game render', () => {
  const game = read('../../../app/game.tsx');
  const home = read('../../../app/index.tsx');
  const settings = read('../../../app/settings.tsx');

  it('game board reads the active world theme, not the legacy block palette', () => {
    expect(game).toContain('useActiveWorldTheme');
    expect(game).not.toContain('getBlockTheme');
    expect(game).not.toContain('s.themeId');
  });

  it('home logo paints from the active world theme palette', () => {
    expect(home).toContain('useActiveWorldTheme');
    expect(home).not.toContain('getBlockTheme');
  });

  it('settings offers unlocked world themes instead of the block palette picker', () => {
    expect(settings).toContain('useUnlockedWorldThemes');
    expect(settings).toContain('setActiveWorldTheme');
    expect(settings).not.toContain('BLOCK_THEMES');
    expect(settings).not.toContain('s.themeId');
  });
});
