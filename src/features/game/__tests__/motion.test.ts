import {
  CLEAR_MOTION,
  PARTICLE_MOTION,
  TRAY_ACTIVATION,
  TRAY_MOTION,
  TRAY_SLOT_INNER_GAP,
  clearCellDelay,
  particleSourceIndexes,
  trayRestingScale,
} from '../animation/motion';

describe('tray interaction motion', () => {
  it('uses the whole slot and extends the drag start target below the tray', () => {
    expect(TRAY_ACTIVATION).toEqual({
      top: 0,
      left: 0,
      right: 0,
      bottom: -24,
    });
  });

  it('keeps appearance and invalid-drop return compact', () => {
    expect(TRAY_MOTION.appearFromScale).toBeGreaterThanOrEqual(0.9);
    expect(TRAY_MOTION.appearDurationMs).toBeLessThanOrEqual(120);
    expect(TRAY_MOTION.grabScale).toBeLessThan(1);
    expect(TRAY_MOTION.returnDurationMs).toBeLessThanOrEqual(140);
    expect(TRAY_MOTION.returnScaleDurationMs).toBeLessThanOrEqual(110);
  });
});

describe('tray resting scale (fit to slot)', () => {
  const slotWidth = 125; // ~(390-16)/3 на типичном телефоне
  const narrowFigW = 88; // h2: 2*43 + 2
  const wideFigW = 223; // h5: 5*43 + 4*2

  it('keeps narrow pieces at the base resting scale', () => {
    expect(trayRestingScale(narrowFigW, slotWidth)).toBe(TRAY_MOTION.restingScale);
  });

  it('shrinks wide pieces so they fit inside their slot', () => {
    const scale = trayRestingScale(wideFigW, slotWidth);
    expect(scale).toBeLessThan(TRAY_MOTION.restingScale);
    // Фигура целиком помещается в слот с зазором → две соседние не налезают.
    expect(wideFigW * scale).toBeLessThanOrEqual(slotWidth - TRAY_SLOT_INNER_GAP + 1e-9);
  });

  it('never collapses below the floor for a pathologically narrow slot', () => {
    expect(trayRestingScale(1000, 5)).toBe(0.2);
  });

  it('falls back to the base scale on degenerate input', () => {
    expect(trayRestingScale(0, slotWidth)).toBe(TRAY_MOTION.restingScale);
    expect(trayRestingScale(wideFigW, Number.NaN)).toBe(TRAY_MOTION.restingScale);
  });
});

describe('line clear motion', () => {
  it('uses a tight wave from the placed piece', () => {
    const placed = [
      [4, 3],
      [4, 4],
    ] as const;

    expect(clearCellDelay([4, 3], placed)).toBe(5);
    expect(clearCellDelay([4, 7], placed)).toBe(35);
    expect(CLEAR_MOTION.staggerMs).toBe(10);
    expect(CLEAR_MOTION.popScale).toBeGreaterThan(1);
  });

  it('caps particle sources while allowing three fragments per source', () => {
    const indexes = particleSourceIndexes(64);

    expect(indexes).toHaveLength(11);
    expect(indexes[0]).toBe(0);
    expect(indexes.at(-1)).toBe(60);
    expect(PARTICLE_MOTION.fragmentsPerSource).toBe(3);
    expect(indexes.length * PARTICLE_MOTION.fragmentsPerSource).toBeLessThanOrEqual(
      PARTICLE_MOTION.maxParticles,
    );
  });
});
