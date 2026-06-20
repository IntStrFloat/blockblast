declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

const read = (relativePath: string) => fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

describe('meta onboarding overlay', () => {
  const overlay = read('../components/OnboardingOverlay.tsx');
  const home = read('../../../app/index.tsx');

  it('is mounted on Home', () => {
    expect(home).toContain('<OnboardingOverlay');
    expect(home).toContain("from '@/features/onboarding'");
  });

  it('self-gates on the seen flag and marks it seen on finish', () => {
    expect(overlay).toContain('useOnboarding');
    expect(overlay).toContain('if (seen) return null');
    expect(overlay).toContain('markSeen()');
  });

  it('onboards into every meta-progression pillar', () => {
    for (const step of ['level', 'worlds', 'map', 'daily', 'capi']) {
      expect(overlay).toContain(`'${step}'`);
    }
    expect(overlay).toContain('MascotFigure');
    expect(overlay).toContain('WORLD_THEMES');
  });

  it('respects reduce-motion', () => {
    expect(overlay).toContain('isReduceMotionEnabled');
    expect(overlay).toContain('reduceMotion');
  });
});
