declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('home screen layout', () => {
  const source = fs.readFileSync(`${__dirname}/../index.tsx`, 'utf8');

  it('keeps the header and main content scrollable without a Home ad banner', () => {
    expect(source).toContain('ScrollView');
    expect(source).toContain('contentContainerStyle');
    expect(source).not.toContain('<AdBanner');
    expect(source).not.toContain("from '@/features/monetization'");
  });
});
