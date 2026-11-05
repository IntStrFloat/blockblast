declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const homeSource = fs.readFileSync(`${__dirname}/../index.tsx`, 'utf8');
const gameSource = fs.readFileSync(`${__dirname}/../game.tsx`, 'utf8');
const adventureSource = fs.readFileSync(`${__dirname}/../adventure.tsx`, 'utf8');
const adventureLevelSource = fs.readFileSync(`${__dirname}/../adventure-level.tsx`, 'utf8');

describe('explicit game entry intents', () => {
  it('routes Home actions with explicit resume and new intents only', () => {
    expect(homeSource).toContain("entry: 'resume'");
    expect(homeSource).toContain("entry: 'new'");
    expect(homeSource).not.toContain("entry: 'daily'");
    expect(gameSource).not.toContain("entry === 'daily'");
  });

  it('resumes only active and revivable saves while final terminal starts fresh', () => {
    const playSource = homeSource.slice(
      homeSource.indexOf('const play = useCallback'),
      homeSource.indexOf('const nextActionCard ='),
    );

    expect(playSource).toContain("savedGame.kind === 'active' || savedGame.kind === 'terminal_revivable'");
    expect(playSource).toContain("entry: 'resume'");
    expect(playSource).toContain('has_saved_game: true');
    expect(playSource).toContain("savedGame.kind === 'terminal_final'");
  });

  it('uses truthful state-specific CTA copy with score and level', () => {
    expect(homeSource).toContain("savedGame.kind === 'active'");
    expect(homeSource).toContain("savedGame.kind === 'terminal_revivable'");
    expect(homeSource).toContain("savedGame.kind === 'terminal_final'");
    expect(homeSource).toContain("'Новая игра'");
    expect(homeSource).toContain('savedGame.score ?? 0');
    expect(homeSource).toContain('savedAdventure.levelIndex ?? 0');
    expect(homeSource).toContain('label={classicLabel}');
    expect(homeSource).toContain('label={adventureLabel}');
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

  it('resumes a bound FTUE run before considering a new tutorial fixture', () => {
    expect(homeSource).toContain("tutorialSave.runKind === 'tutorial'");
    expect(homeSource).toContain("params: { entry: resumeTutorial ? 'resume' : 'tutorial'");
    const tutorialBranch = gameSource.slice(
      gameSource.indexOf("entry === 'tutorial'"),
      gameSource.indexOf('const readyTimer'),
    );
    expect(tutorialBranch).toContain("summary.kind === 'active'");
    expect(tutorialBranch.indexOf('loadSaved()')).toBeLessThan(
      tutorialBranch.indexOf('createTutorialGame(seed)'),
    );
  });

  it('tracks Home continue state from the current saved summary, not only active runs', () => {
    expect(homeSource).toContain('const savedSummary = getSavedGameSummary();');
    expect(homeSource).toContain("home_state: savedSummary.kind !== 'none' ? 'continue'");
  });

  it('measures resume outcome and the first accepted move after return in both modes', () => {
    for (const source of [gameSource, adventureLevelSource]) {
      expect(source).toContain("track('resume_attempt'");
      expect(source).toContain("track('resume_result'");
      expect(source).toContain("'return_first_move'");
    }
  });

  it('confirms replacing an active game from the pause overlay', () => {
    expect(gameSource).toContain('const confirmRestart');
    expect(gameSource).toContain('onRestart={confirmRestart}');
  });

  it('uses mode-specific board sizing and docks banners below gameplay content', () => {
    expect(gameSource).toContain('getClassicPlayfieldMetrics(');
    expect(adventureLevelSource).toContain('getAdventurePlayfieldMetrics(');
    expect(gameSource).toContain('onLayout={handlePlayfieldLayout}');
    expect(adventureLevelSource).toContain('onLayout={handlePlayfieldLayout}');
    expect(gameSource).toContain('trayFit,');
    expect(gameSource).toContain('height: trayHeight');
    expect(gameSource).toContain('<GameBannerDock');
    expect(adventureLevelSource).toContain('<GameBannerDock');
    expect(gameSource).toContain("overflow: 'hidden'");
    expect(gameSource).not.toContain('adSlotHeight');
    expect(gameSource).not.toContain('AD_BOTTOM_SAFE_GAP');
  });

  it('mounts exactly one game background layer', () => {
    const matches = gameSource.match(/<GameBackground/g) ?? [];

    expect(matches).toHaveLength(1);
  });

  it('keeps praise mounted during FTUE so clear lettering cannot replay late', () => {
    expect(gameSource).toContain('<PraiseBanner suppressed=');
    expect(gameSource).not.toContain('{!ftueActive ? <PraiseBanner /> : null}');
  });

  it('pre-mounts the mascot scene instead of constructing it after the clear', () => {
    expect(gameSource).toContain('active={!ftueActive}');
    expect(gameSource).not.toContain('{!ftueActive ? <MascotLayer');
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
