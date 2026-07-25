declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const source = fs.readFileSync(`${__dirname}/../components/FailOverlay.tsx`, 'utf8');

describe('FailOverlay', () => {
  it('uses the shared game actions and localized supporting copy', () => {
    expect(source).toContain("t('adventure.failedTitle', lang)");
    expect(source).toContain("t('adventure.failedHint', lang)");
    expect(source).toContain('GameButton');
    expect(source).toContain('ZoomIn.duration(220)');
  });
});
