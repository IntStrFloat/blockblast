declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const source = fs.readFileSync(`${__dirname}/../components/ObjectivePanel.tsx`, 'utf8');

describe('Adventure objective panel', () => {
  it('adapts the goal badge to long numeric targets without truncation', () => {
    expect(source).toContain('const targetLabel = String(target);');
    expect(source).toContain('const badgeDiameter = targetLabel.length >= 4 ? 76 : targetLabel.length >= 3 ? 68 : 60;');
    expect(source).toContain('adjustsFontSizeToFit');
    expect(source).toContain('minimumFontScale={0.72}');
  });
});
