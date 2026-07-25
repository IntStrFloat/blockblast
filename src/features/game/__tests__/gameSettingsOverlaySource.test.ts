declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('in-game settings source contract', () => {
  const settings = fs.readFileSync(`${__dirname}/../components/PauseOverlay.tsx`, 'utf8');
  const hud = fs.readFileSync(`${__dirname}/../components/Hud.tsx`, 'utf8');
  const game = fs.readFileSync(`${__dirname}/../../../app/game.tsx`, 'utf8');

  it('opens from a gear in the top-right during every game, including tutorial', () => {
    expect(hud).toContain('<GearIcon');
    expect(hud).not.toContain('preset="button">II');
    expect(hud).not.toContain('!tutorial ?');
  });

  it('contains only supported controls plus Home and replay', () => {
    expect(settings).toContain("t('settings.title', lang)");
    expect(settings).toContain("t('pause.sound', lang)");
    expect(settings).toContain("t('pause.haptics', lang)");
    expect(settings).toContain("t('pause.home', lang)");
    expect(settings).toContain("t('pause.restart', lang)");
    expect(settings).toContain('onClose');
  });

  it('keeps Home behind settings and intercepts the Android back action', () => {
    expect(game).toContain('BackHandler.addEventListener');
    expect(game).toContain('onOpenSettings={() => setPaused(true)}');
    expect(game.indexOf('<GameOverOverlay')).toBeLessThan(game.indexOf('<PauseOverlay'));
  });
});
