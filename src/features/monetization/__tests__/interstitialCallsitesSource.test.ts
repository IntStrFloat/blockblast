declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const classic = fs.readFileSync(`${__dirname}/../../game/components/GameOverOverlay.tsx`, 'utf8');
const adventure = fs.readFileSync(`${__dirname}/../../../app/adventure-level.tsx`, 'utf8');

describe('interstitial impression persistence call sites', () => {
  it.each([['classic', classic], ['adventure', adventure]])(
    '%s persists the shown counter inside the impression callback',
    (_name, source) => {
      expect(source).toContain('let impressionRecorded = false');
      expect(source).toContain('if (impressionRecorded) return');
      expect(source).toContain('recordInterstitialShown(');
      expect(source).toContain('), true);');
      expect(source).not.toContain("if (result === 'shown')");
    },
  );
});
