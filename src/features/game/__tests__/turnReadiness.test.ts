import { turnReadinessSource } from '../turnReadiness';

describe('turn readiness gate', () => {
  it('waits for native layout on a playable committed refill', () => {
    expect(turnReadinessSource(true, true)).toBe('native_layout');
  });

  it('keeps an existing playable tray immediately ready', () => {
    expect(turnReadinessSource(false, true)).toBe('existing_tray');
  });

  it('never reports terminal new trays or terminal remaining trays as interactive', () => {
    expect(turnReadinessSource(true, false)).toBeNull();
    expect(turnReadinessSource(false, false)).toBeNull();
  });
});
