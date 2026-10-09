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

  it('uses presentation ids and arrivals without an independent HUD timer', () => {
    expect(source).toContain('lastAdventureEvent.presentationId');
    expect(source).toContain('seenEventIdsRef');
    expect(source).toContain('arrivedEventIdsRef');
    expect(source).toContain('Math.max(value, arrival.total)');
    expect(source).toContain('setPendingDelta((value) => value + lastAdventureEvent.jewelsCollectedThisMove)');
    expect(source).not.toContain('setTimeout');
    expect(source).toContain('queueMicrotask');
  });

  it('pairs one numeric goal with its glyph and exposes an aggregated contribution', () => {
    expect(source).toContain('{`${current}/${target}`}');
    expect(source).toContain('<JewelIcon');
    expect(source).toContain('<StarIcon');
    expect(source).not.toContain('{targetLabel}');
    expect(source).toContain('Math.max(0, target - current)');
    expect(source).toContain('+{pendingDelta}');
    expect(source).toContain('accessibilityLiveRegion="polite"');
  });
});
