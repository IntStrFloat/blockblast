import {
  comboCelebrationFor,
  comboCelebrationTierFor,
} from '../animation/comboCelebration';
import { EFFECT_NODE_BUDGET } from '../animation/effectSequence';

describe('combo celebration presentation', () => {
  it('builds small deterministic glints around the lettering', () => {
    const first = comboCelebrationFor(3, 360, false);
    const second = comboCelebrationFor(3, 360, false);

    expect(first).toEqual(second);
    expect(first.tier).toBe('compact');
    expect(first.rays).toHaveLength(0);
    expect(first.particles).toHaveLength(6);
    expect(first.particles.map((particle) => particle.kind)).toEqual(
      expect.arrayContaining(['spark', 'block']),
    );
    expect(first.particles.every((particle) => particle.distance >= 360 * 0.09)).toBe(true);
    expect(first.particles.every((particle) => particle.distance <= 360 * 0.24)).toBe(true);
    expect(first.particles.every((particle) => particle.size < 7 && particle.travel < 18)).toBe(true);
  });

  it('raises the spectacle with the combo while keeping the overlay budget bounded', () => {
    const comboTwo = comboCelebrationFor(2, 360, false);
    const comboSix = comboCelebrationFor(6, 360, false);

    expect(comboTwo.particles).toHaveLength(6);
    expect(comboSix.particles.length).toBeGreaterThan(comboTwo.particles.length);
    expect(comboSix.particles).toHaveLength(9);
    expect(comboSix.intensity).toBeGreaterThan(comboTwo.intensity);
    expect(comboSix.labelScale).toBeGreaterThan(comboTwo.labelScale);
    expect(comboTwo.tier).toBe('compact');
    expect(comboSix.tier).toBe('charged');
  });

  it('uses discrete compact, charged, and legendary stages', () => {
    expect(comboCelebrationTierFor(2)).toBe('compact');
    expect(comboCelebrationTierFor(4)).toBe('compact');
    expect(comboCelebrationTierFor(5)).toBe('charged');
    expect(comboCelebrationTierFor(9)).toBe('charged');
    expect(comboCelebrationTierFor(10)).toBe('legendary');

    const legendary = comboCelebrationFor(10, 360, false);
    expect(legendary.rays).toHaveLength(4);
    expect(legendary.particles).toHaveLength(12);
    expect(legendary.sweepStrength).toBeLessThanOrEqual(0.25);
  });

  it.each([2, 4, 5, 9, 10, 100, Number.MAX_SAFE_INTEGER])('keeps combo %s within the shared overlay allowance including decorative layers', (combo) => {
    const presentation = comboCelebrationFor(combo, 360, false);
    expect(presentation).toEqual(comboCelebrationFor(combo, 360, false));
    // Allow the glow, two sweep strokes and the lettering in addition to moving accents.
    expect(presentation.particles.length + presentation.rays.length + 4)
      .toBeLessThanOrEqual(EFFECT_NODE_BUDGET.comboCelebrationMax);
    expect(presentation.particles.every((particle) => particle.size < 7 && particle.travel <= 360 * 0.07)).toBe(true);
  });

  it('keeps celebration particles independent from cleared-cell destruction coordinates', () => {
    const presentation = comboCelebrationFor(4, 320, false);

    for (const particle of presentation.particles) {
      expect(particle).not.toHaveProperty('row');
      expect(particle).not.toHaveProperty('col');
      expect(particle).not.toHaveProperty('cell');
      expect(Number.isFinite(particle.angleDeg)).toBe(true);
      expect(Number.isFinite(particle.travel)).toBe(true);
    }
  });

  it('falls back to static lettering for reduced motion', () => {
    const presentation = comboCelebrationFor(5, 360, true);

    expect(presentation.rays).toEqual([]);
    expect(presentation.particles).toEqual([]);
    expect(presentation.labelScale).toBe(1);
    expect(presentation.entranceScale).toBe(1);
    expect(presentation.sweepStrength).toBe(0);
  });
});
