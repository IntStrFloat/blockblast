declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

const read = (relativePath: string) =>
  fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

const layerSource = read('../components/MascotLayer.tsx');

describe('MascotLayer drag/drop contract', () => {
  it('keeps the mascot brain paused while the loss drop is resolving', () => {
    expect(layerSource).toContain('const mascotDropping = useSharedValue(0)');
    expect(layerSource).toContain(
      '() => Math.max(dragActive.value, mascotDragging.value, mascotDropping.value)',
    );
    expect(layerSource).toContain('mascotDropping.value = 1');
    expect(layerSource).toContain('mascotDropping.value = 0');
    expect(layerSource).toContain('if (!mascotDropping.value) mascotDragging.value = 0');
  });
});
