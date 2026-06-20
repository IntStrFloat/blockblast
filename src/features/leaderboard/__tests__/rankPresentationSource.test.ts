declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('leaderboard rank presentation', () => {
  const cardSource = fs.readFileSync(`${__dirname}/../components/WeeklyCard.tsx`, 'utf8');
  const screenSource = fs.readFileSync(`${__dirname}/../../../app/leaderboard.tsx`, 'utf8');

  it('uses only the server snapshot for the home card score and rank', () => {
    expect(cardSource).not.toContain('getVisibleLeaderboardEntry');
    expect(cardSource).not.toContain('getVisibleWeeklyBest');
    expect(cardSource).toContain('snapshot?.currentPlayer.weeklyBest ?? 0');
    expect(cardSource).toContain('snapshot?.currentPlayer.rank');
  });

  it('uses one server weekly result throughout the leaderboard screen', () => {
    expect(screenSource).not.toContain('getVisibleLeaderboardEntry');
    expect(screenSource).not.toContain('getVisibleWeeklyBest');
    expect(screenSource).toContain('const weeklyBest = snapshot?.currentPlayer.weeklyBest ?? 0');
    expect(screenSource).not.toContain("t('leaderboard.personalWeeklyBest', lang)");
    expect(screenSource).not.toContain("t('leaderboard.rankedWeeklyBest', lang)");
  });
});
