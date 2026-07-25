declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

const read = (relativePath: string) => fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

describe('legacy meta onboarding overlay', () => {
  const overlay = read('../components/OnboardingOverlay.tsx');
  const home = read('../../../app/index.tsx');

  it('is not mounted on Home because action FTUE owns first launch', () => {
    expect(home).not.toContain('<OnboardingOverlay');
    expect(home).toContain('shouldEnterFtue');
    expect(home).toContain("entry: 'tutorial'");
  });

  it('self-gates on the seen flag and marks it seen on finish', () => {
    expect(overlay).toContain('useOnboarding');
    expect(overlay).toContain('if (seen) return null');
    expect(overlay).toContain('markSeen()');
  });

  it('onboards into the active meta-progression pillars', () => {
    for (const step of ['level', 'worlds', 'map', 'capi']) {
      expect(overlay).toContain(`'${step}'`);
    }
    expect(overlay).not.toContain("case 'daily'");
    expect(overlay).toContain('MascotFigure');
    expect(overlay).toContain('WORLD_THEMES');
  });

  it('respects reduce-motion', () => {
    expect(overlay).toContain('isReduceMotionEnabled');
    expect(overlay).toContain('reduceMotion');
  });
});
