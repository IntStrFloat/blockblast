declare const __dirname: string;

const fs = jest.requireActual<{
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('revive button source contract', () => {
  const path = `${__dirname}/../components/ReviveButton.tsx`;

  it('uses a custom green gradient and a video-ad SVG icon', () => {
    expect(fs.existsSync(path)).toBe(true);

    const source = fs.readFileSync(path, 'utf8');
    expect(source).toContain('<LinearGradient');
    expect(source).toContain("'#43E45F'");
    expect(source).toContain("'#16A82D'");
    expect(source).toContain('<Svg');
    expect(source).toContain('<Path');
    expect(source).toContain('shadowColor');
    expect(source).toContain('disabled');
  });
});
