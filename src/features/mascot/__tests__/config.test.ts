import { MASCOT_CONFIG } from '../logic/config';

// После декаплинга (спека 15) маскот-конфиг хранит только поведение/моргание/ночь и
// эвристику затыка подсказки. Кривая/стадии/награды/разлок помощников — в progression.
describe('MASCOT_CONFIG', () => {
  it('exposes a non-empty behavior action pool with valid stage gates and durations', () => {
    expect(MASCOT_CONFIG.actions.length).toBeGreaterThan(0);
    for (const action of MASCOT_CONFIG.actions) {
      expect(action.minStage).toBeGreaterThanOrEqual(1);
      expect(action.minStage).toBeLessThanOrEqual(4);
      expect(action.maxDurationMs).toBeGreaterThanOrEqual(action.minDurationMs);
    }
  });

  it('blink interval is a positive ascending range', () => {
    expect(MASCOT_CONFIG.blink.minMs).toBeGreaterThan(0);
    expect(MASCOT_CONFIG.blink.maxMs).toBeGreaterThan(MASCOT_CONFIG.blink.minMs);
  });

  it('keeps only the hint stuck-threshold heuristic (helper unlock now lives in progression)', () => {
    expect(MASCOT_CONFIG.helpers.hint.stuckThreshold).toBeGreaterThan(0);
  });

  it('night hour is a valid hour of day', () => {
    expect(MASCOT_CONFIG.nightHour).toBeGreaterThanOrEqual(0);
    expect(MASCOT_CONFIG.nightHour).toBeLessThan(24);
  });
});
