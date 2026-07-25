declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const source = fs.readFileSync(`${__dirname}/../adventure.tsx`, 'utf8');

describe('Adventure map layout', () => {
  it('keeps the established level-map geometry intact', () => {
    expect(source).toContain('{ offset: 0, count: 11 }');
    expect(source).toContain('{ offset: 1, count: 9 }');
    expect(source).toContain('{ offset: 4, count: 3 }');
    expect(source).toContain('left: (row.offset + columnIndex) * cell');
    expect(source).toContain('top: (MAP_ROWS.length - 1 - rowIndex) * cell');
  });

  it('makes the map scroll independently from the fixed play action', () => {
    expect(source).toContain('<ScrollView');
    expect(source).toContain('contentContainerStyle={styles.mapScrollContent}');
    expect(source).toContain('styles.footer');
    expect(source.indexOf('</ScrollView>')).toBeLessThan(source.indexOf('styles.footer'));
  });
});
