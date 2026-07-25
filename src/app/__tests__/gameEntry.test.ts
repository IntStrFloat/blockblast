declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const homeSource = fs.readFileSync(`${__dirname}/../index.tsx`, 'utf8');
const gameSource = fs.readFileSync(`${__dirname}/../game.tsx`, 'utf8');
const adventureSource = fs.readFileSync(`${__dirname}/../adventure.tsx`, 'utf8');

describe('explicit game entry intents', () => {
  it('routes Home actions with explicit resume and new intents only', () => {
    expect(homeSource).toContain("entry: 'resume'");
    expect(homeSource).toContain("entry: 'new'");
    expect(homeSource).not.toContain("entry: 'daily'");
    expect(gameSource).not.toContain("entry === 'daily'");
  });

  it('opens a new game before remote profile and ranked ticket work finishes', () => {
    const startNewSource = homeSource.slice(
      homeSource.indexOf('const startNew'),
      homeSource.indexOf('const confirmNew'),
    );

    expect(startNewSource.indexOf("entry: 'new'")).toBeLessThan(
      startNewSource.indexOf('bootstrapRemote()'),
    );
    expect(startNewSource.indexOf('bootstrapRemote()')).toBeLessThan(
      startNewSource.indexOf('issueTickets'),
    );
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

  it('keeps the game screen height fixed while tray pieces and ads change', () => {
    expect(gameSource).toContain('height: trayHeight');
    expect(gameSource).toContain('height: adSlotHeight');
    expect(gameSource).toContain('HUD_RESERVED_HEIGHT');
    expect(gameSource).toContain('TRAY_SLOT_MIN_HEIGHT');
    expect(gameSource).toContain('TRAY_SLOT_MAX_HEIGHT');
    expect(gameSource).toContain('TRAY_SLOT_HEIGHT_RATIO');
    expect(gameSource).toContain('AD_SLOT_MIN_HEIGHT');
    expect(gameSource).toContain('AD_SLOT_HEIGHT_RATIO');
    expect(gameSource).toContain('CONTENT_TOP_PADDING');
    expect(gameSource).toContain('AD_BOTTOM_SAFE_GAP');
    expect(gameSource).toContain("overflow: 'hidden'");
    expect(gameSource).toContain("justifyContent: 'flex-end'");
    expect(gameSource).not.toContain("height: '20%'");
    expect(gameSource).not.toContain('Math.min(132');
    expect(gameSource).not.toContain('stageHeight * 0.1');
    expect(gameSource).not.toContain('Math.min(110');
    expect(gameSource).not.toContain('stageHeight * 0.08');
    expect(gameSource).not.toContain('verticalGap * 4 +\n    24');
    expect(gameSource).not.toContain("justifyContent: 'space-between'");
  });

  it('mounts exactly one game background layer', () => {
    const matches = gameSource.match(/<GameBackground/g) ?? [];

    expect(matches).toHaveLength(1);
  });

  it('leaves the adventure hub through an explicit home route', () => {
    const backButtonSource = adventureSource.slice(
      adventureSource.indexOf('accessibilityLabel={t(\'leaderboard.back\', lang)}'),
      adventureSource.indexOf('<ChevronIcon size={32}'),
    );

    expect(backButtonSource).toContain("router.replace('/' as Href)");
    expect(backButtonSource).not.toContain('router.back()');
  });
});
