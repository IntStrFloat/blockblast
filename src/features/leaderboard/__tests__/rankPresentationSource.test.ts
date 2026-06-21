declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('leaderboard rank presentation', () => {
  const cardSource = fs.readFileSync(`${__dirname}/../components/WeeklyCard.tsx`, 'utf8');
  const screenSource = fs.readFileSync(`${__dirname}/../../../app/leaderboard.tsx`, 'utf8');
  const presentationSource = fs.readFileSync(`${__dirname}/../presentation.ts`, 'utf8');

  it('blends the server snapshot with the current-week local result via one selector', () => {
    // Единый источник недельного рекорда: max(серверный, локальный ТЕКУЩЕЙ недели).
    // Иначе экран/карточка показывали 0, пока сабмит в очереди или нет бэкенда.
    expect(presentationSource).toContain('export function selectEffectiveWeeklyBest');
    expect(presentationSource).toContain('snapshot?.currentPlayer.weeklyBest ?? 0');
    expect(presentationSource).toContain('localWeekly');
  });

  it('resolves record, rank and rows through one view selector', () => {
    // Рекорд, место и строки списка — из одного resolveWeeklyView, поэтому
    // показанный рекорд всегда соответствует строке игрока в таблице.
    expect(presentationSource).toContain('export function resolveWeeklyView');
    expect(presentationSource).toContain('selectEffectiveWeeklyBest');
  });

  it('the home card and the screen both consume the shared view selector', () => {
    expect(cardSource).toContain('resolveWeeklyView');
    expect(screenSource).toContain('resolveWeeklyView');
    // И место теперь из общего селектора, а не из снапшота напрямую.
    expect(cardSource).not.toContain('snapshot?.currentPlayer.rank');
    expect(screenSource).not.toContain('snapshot?.currentPlayer.rank');
    // Никаких устаревших источников/дублирующих лейблов.
    expect(cardSource).not.toContain('getVisibleWeeklyBest');
    expect(screenSource).not.toContain('getVisibleWeeklyBest');
    expect(screenSource).not.toContain("t('leaderboard.personalWeeklyBest', lang)");
    expect(screenSource).not.toContain("t('leaderboard.rankedWeeklyBest', lang)");
  });
});
