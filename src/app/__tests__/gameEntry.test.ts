declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const homeSource = fs.readFileSync(`${__dirname}/../index.tsx`, 'utf8');
const gameSource = fs.readFileSync(`${__dirname}/../game.tsx`, 'utf8');

describe('explicit game entry intents', () => {
  it('routes Home actions with explicit resume, new, and daily intents', () => {
    expect(homeSource).toContain("entry: 'resume'");
    expect(homeSource).toContain("entry: 'new'");
    expect(homeSource).toContain("entry: 'daily'");
  });

  it('requires confirmation before daily replacement when a save exists', () => {
    expect(homeSource).toContain('const confirmDaily');
    expect(homeSource).toContain('onPress={confirmDaily}');
  });

  it('never falls back from a failed resume to a new game', () => {
    expect(gameSource).toContain("entry === 'resume'");
    expect(gameSource).not.toMatch(/if\s*\(\s*!.*loadSaved.*\)\s*newGame/);
    expect(gameSource).toContain("router.replace('/')");
  });

  it('confirms replacing an active game from the pause overlay', () => {
    expect(gameSource).toContain('const confirmRestart');
    expect(gameSource).toContain('onRestart={confirmRestart}');
  });
});
