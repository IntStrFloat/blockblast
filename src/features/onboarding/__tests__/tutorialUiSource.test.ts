declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const read = (relativePath: string) => fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

describe('action-driven tutorial UI', () => {
  const hints = read('../../game/components/TutorialHints.tsx');
  const pointer = read('../components/TutorialPointer.tsx');

  it('does not advance by tapping instructional copy', () => {
    expect(hints).not.toContain('onPress={advance}');
    expect(hints).not.toContain('tutorialDone');
    expect(hints).toContain('useFtueStore');
  });

  it('uses a vector pointer and no emoji hand', () => {
    expect(pointer).toContain("from 'react-native-svg'");
    expect(pointer).toContain('<Path');
    expect(hints).not.toContain('1F446');
  });

  it('keeps guidance transparent to drag and provides an accessible 48dp skip', () => {
    expect(pointer).toContain('pointerEvents="none"');
    expect(hints).toContain('pointerEvents="none"');
    expect(hints).toContain('minWidth: 48');
    expect(hints).toContain('minHeight: 48');
    expect(hints).toContain('accessibilityRole="button"');
    expect(hints).toContain('accessibilityLabel={skipLabel}');
  });

  it('has a static reduced-motion pointer path', () => {
    expect(pointer).toContain('reducedMotion ? 1 : 0');
    expect(pointer).toContain('reducedMotion ? 0.92');
  });

  it('removes guidance after the first user placement', () => {
    expect(hints).toContain('placements > 0');
  });
});
