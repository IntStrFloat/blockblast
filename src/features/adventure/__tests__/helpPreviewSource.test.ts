declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const screen = fs.readFileSync(`${__dirname}/../../../app/adventure-level.tsx`, 'utf8');
const cell = fs.readFileSync(`${__dirname}/../../game/components/BoardCell.tsx`, 'utf8');
const drag = fs.readFileSync(`${__dirname}/../../game/drag/useDrag.ts`, 'utf8');

describe('Adventure retry help preview', () => {
  it('uses a persistent channel that invalid drag cleanup cannot erase', () => {
    expect(screen).toContain('const assistPreview = useSharedValue<number[]>(EMPTY_MASK)');
    expect(screen).toContain('assistPreview.value = previewMask(');
    expect(screen).toContain('assistPreviewColor.value = piece.colorId');
    expect(cell).toContain('const assistMask = assistPreviewShared?.value[index] ?? 0');
    expect(cell).toContain('const mask = dragMask !== 0 ? dragMask : assistMask');
    expect(drag).not.toContain('assistPreview');
  });
});
