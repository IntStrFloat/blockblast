import {
  BURST_MOTION,
  CLEAR_MOTION,
  GAME_FEEL_MOTION,
  PARTICLE_MOTION,
  SPECTACLE_MOTION,
  TRAY_ACTIVATION,
  TRAY_MOTION,
  TRAY_SLOT_INNER_GAP,
  clearCellDelay,
  particleSourceIndexes,
  shouldPulseOnFill,
  trayRestingScale,
} from '../animation/motion';

describe('cell dissolution motion', () => {
  it('clears locally within 240 ms and preserves an opacity-only reduced mode', () => {
    expect(BURST_MOTION.dissolveDurationMs + 14 * CLEAR_MOTION.staggerMs).toBeLessThanOrEqual(240);
    expect(BURST_MOTION.dissolveScale).toBeGreaterThanOrEqual(0.7);
    expect(BURST_MOTION.reducedFadeMs).toBeLessThanOrEqual(150);
  });
});

describe('shouldPulseOnFill', () => {
  it('пульс размещения только на переходе пусто → блок', () => {
    expect(shouldPulseOnFill(0, 3)).toBe(true);
    expect(shouldPulseOnFill(0, 1)).toBe(true);
  });

  it('без пульса на маунте заполненной ячейки, очистке и рекраске', () => {
    expect(shouldPulseOnFill(3, 3)).toBe(false); // резюм сохранённой партии
    expect(shouldPulseOnFill(3, 0)).toBe(false); // очистка
    expect(shouldPulseOnFill(0, 0)).toBe(false); // пустая остаётся пустой
    expect(shouldPulseOnFill(2, 3)).toBe(false); // смена цвета без прохода через 0
  });
});

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
    expect(TRAY_MOTION.appearDurationMs).toBeLessThanOrEqual(150);
    expect(TRAY_MOTION.grabScale).toBe(1);
    expect(TRAY_MOTION.returnDurationMs).toBeLessThanOrEqual(140);
    expect(TRAY_MOTION.returnScaleDurationMs).toBeLessThanOrEqual(110);
  });
});

describe('tray resting scale (fit to slot)', () => {
  const slotWidth = 125; // ~(390-16)/3 на типичном телефоне
  const cell = 43; // клетка крупной adventure-доски
  const narrowFigW = 88; // h2: 2*43 + 2
  const wideFigW = 223; // h5: 5*43 + 4*2

  it('keeps narrow pieces at the base resting scale', () => {
    expect(trayRestingScale(narrowFigW, cell, slotWidth)).toBe(TRAY_MOTION.restingScale);
  });

  it('shrinks wide pieces so they fit inside their slot', () => {
    const scale = trayRestingScale(wideFigW, cell, slotWidth);
    expect(scale).toBeLessThan(TRAY_MOTION.restingScale);
    // Фигура целиком помещается в слот с зазором → две соседние не налезают.
    expect(wideFigW * scale).toBeLessThanOrEqual(slotWidth - TRAY_SLOT_INNER_GAP + 1e-9);
  });

  it('shrinks tall pieces so they fit the slot height (не вылезают за трей)', () => {
    // v5 на крупной доске: узкая по ширине, но высокая (223px) — без учёта
    // высоты слота (138) фигура вылезала бы за нижний край трея.
    const tallFigH = 223; // v5: 5*43 + 4*2
    const slotHeight = 138;
    const scale = trayRestingScale(cell, tallFigH, slotWidth, slotHeight);
    expect(scale).toBeLessThan(TRAY_MOTION.restingScale);
    expect(tallFigH * scale).toBeLessThanOrEqual(slotHeight + 1e-9);
  });

  it('ignores height when slotHeight is omitted (Endless — прежнее поведение)', () => {
    expect(trayRestingScale(cell, 223, slotWidth)).toBe(TRAY_MOTION.restingScale);
  });

  it('never collapses below the floor for a pathologically narrow slot', () => {
    expect(trayRestingScale(1000, 1000, 5)).toBe(0.2);
  });

  it('falls back to the base scale on degenerate input', () => {
    expect(trayRestingScale(0, cell, slotWidth)).toBe(TRAY_MOTION.restingScale);
    expect(trayRestingScale(wideFigW, cell, Number.NaN)).toBe(TRAY_MOTION.restingScale);
  });
});

describe('line clear motion', () => {
  it('uses a tight wave from the placed piece', () => {
    const placed = [
      [4, 3],
      [4, 4],
    ] as const;

    expect(clearCellDelay([4, 3], placed)).toBe(2);
    expect(clearCellDelay([4, 7], placed)).toBe(14);
    expect(CLEAR_MOTION.staggerMs).toBeLessThanOrEqual(4);
    expect(CLEAR_MOTION.popScale).toBe(1);
  });

  it('caps particle sources while allowing three fragments per source', () => {
    const indexes = particleSourceIndexes(64);

    expect(indexes).toHaveLength(8);
    expect(indexes[0]).toBe(0);
    expect(indexes.at(-1)).toBe(56);
    expect(PARTICLE_MOTION.fragmentsPerSource).toBe(3);
    expect(indexes.length * PARTICLE_MOTION.fragmentsPerSource).toBeLessThanOrEqual(
      PARTICLE_MOTION.maxParticles,
    );
  });
});

describe('combo celebration motion', () => {
  it('keeps combo pulses short and settled instead of lingering', () => {
    expect(SPECTACLE_MOTION.praiseEndMs - SPECTACLE_MOTION.praiseStartMs).toBeLessThanOrEqual(440);
    expect(GAME_FEEL_MOTION.comboFramePulseDurationMs).toBeLessThanOrEqual(220);
    expect(GAME_FEEL_MOTION.comboShakeDurationMs).toBeLessThanOrEqual(150);
  });
});
