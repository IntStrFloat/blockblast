declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');

describe('score HUD source contract', () => {
  const source = fs.readFileSync(`${__dirname}/../components/Hud.tsx`, 'utf8');

  it('renders the authoritative store score without a native text input fallback', () => {
    expect(source).toContain('useGameStore((s) => s.game.score)');
    expect(source).toMatch(/<AppText[^>]*preset="score"[^>]*>\s*{score}\s*<\/AppText>/);
    expect(source).not.toContain('TextInput');
    expect(source).not.toContain('AnimatedTextInput');
    expect(source).not.toContain('defaultValue="0"');
  });
});
