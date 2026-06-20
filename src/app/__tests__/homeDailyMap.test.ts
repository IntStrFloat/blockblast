declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

const read = (relativePath: string) => fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

describe('home daily card + achievements map link', () => {
  const home = read('../index.tsx');
  const card = read('../../features/dailybonus/components/DailyCard.tsx');

  it('renders the daily bonus card and a link to the achievements map', () => {
    expect(home).toContain('<DailyCard');
    expect(home).toContain("router.push('/map')");
    expect(home).toContain("t('home.map', lang)");
  });

  it('daily card claims through the store, gates on first game, and reveals the payload', () => {
    expect(card).toContain('useDailyBonus.getState().claim()');
    expect(card).toContain('gamesPlayed < 1');
    expect(card).toContain('dailyPreview');
    expect(card).toContain('DailyReveal');
  });
});
