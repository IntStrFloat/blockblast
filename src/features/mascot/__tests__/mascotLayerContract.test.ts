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
    expect(layerSource).toContain('const mascotReturning = useSharedValue(0)');
    expect(layerSource).toContain(
      '() => Math.max(dragActive.value, mascotDragging.value, mascotDropping.value, mascotReturning.value)',
    );
    expect(layerSource).toContain('mascotDropping.value = 1');
    expect(layerSource).toContain('mascotDropping.value = 0');
    expect(layerSource).toContain('if (!mascotDropping.value && !mascotReturning.value) mascotDragging.value = 0');
  });

  it('returns lifted mascot to the floor without a bouncy spring loop', () => {
    expect(layerSource).toContain('const LIFT_RETURN_MS = 180');
    expect(layerSource).toContain('mascotReturning.value = 1');
    expect(layerSource).toContain('motion.bob.value = withTiming(0, { duration: LIFT_RETURN_MS }');
    expect(layerSource).not.toContain('motion.bob.value = withSpring(0);');
  });
});
