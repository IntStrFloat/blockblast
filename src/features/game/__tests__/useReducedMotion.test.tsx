declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('useReducedMotion source contract', () => {
  const source = fs.readFileSync(`${__dirname}/../animation/useReducedMotion.ts`, 'utf8');

  it('reads the initial reduce-motion preference from AccessibilityInfo', () => {
    expect(source).toContain('AccessibilityInfo.isReduceMotionEnabled()');
    expect(source).toContain('setReducedMotion(enabled)');
  });

  it('subscribes to reduceMotionChanged updates', () => {
    expect(source).toContain('AccessibilityInfo.addEventListener(');
    expect(source).toContain("'reduceMotionChanged'");
    expect(source).toContain('setReducedMotion');
  });

  it('guards against late async resolution after unmount', () => {
    expect(source).toContain('let mounted = true;');
    expect(source).toContain('if (mounted) setReducedMotion(enabled);');
    expect(source).toContain('mounted = false;');
  });

  it('removes the AccessibilityInfo subscription during cleanup', () => {
    expect(source).toContain('subscription.remove();');
  });
});
