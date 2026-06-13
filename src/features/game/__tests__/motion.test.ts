import {
  CLEAR_MOTION,
  PARTICLE_MOTION,
  TRAY_ACTIVATION,
  TRAY_MOTION,
  clearCellDelay,
  particleSourceIndexes,
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
