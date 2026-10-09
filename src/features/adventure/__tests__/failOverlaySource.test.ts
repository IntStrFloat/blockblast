declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const source = fs.readFileSync(`${__dirname}/../components/FailOverlay.tsx`, 'utf8');

describe('FailOverlay', () => {
  it('keeps accessible result context and shared actions while making the tip optional', () => {
    expect(source).toContain("t('adventure.failedTitle', lang)");
    expect(source).toContain("t('adventure.failureRemaining', lang)");
    expect(source).toContain('accessibilityLabel={resultLabel}');
    expect(source).toContain('accessibilityState={{ expanded: showTip }}');
    expect(source).toContain("t('adventure.retry', lang)");
    expect(source).not.toContain("t('adventure.helpOffer', lang)");
    expect(source).toContain('resultLabel');
    expect(source).toContain('onRetryWithHelp');
    expect(source).toContain('GameButton');
    expect(source).toContain('ZoomIn.duration(220)');
  });
});
