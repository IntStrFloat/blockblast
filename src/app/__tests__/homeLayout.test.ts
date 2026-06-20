declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('home screen layout', () => {
  const source = fs.readFileSync(`${__dirname}/../index.tsx`, 'utf8');

  it('keeps the header and main content scrollable above the fixed ad banner', () => {
    expect(source).toContain('ScrollView');
    expect(source).toContain('contentContainerStyle');
    expect(source.indexOf('<ScrollView')).toBeLessThan(source.indexOf('<AdBanner'));
    expect(source.indexOf('</ScrollView>')).toBeLessThan(source.indexOf('<AdBanner'));
    expect(source).not.toContain("position: 'absolute'");
  });
});
