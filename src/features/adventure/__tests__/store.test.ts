import { useAdventure } from '../store';
import { seasonLength } from '../logic/seasons';

describe('adventure store', () => {
  beforeEach(() => {
    useAdventure.getState().reset();
  });

  it('advances level, daily goal counter, and consecutive wins', () => {
    useAdventure.getState().recordWin('2026-07-05');

    const state = useAdventure.getState();
    expect(state.levelIndex).toBe(1);
    expect(state.consecutive).toBe(1);
    expect(state.dailyCleared('2026-07-05')).toBe(1);
    expect(state.dailyCleared('2026-07-06')).toBe(0);
  });

  it('resets consecutive on fail and rolls season into trophy list', () => {
    useAdventure.setState({ seasonId: 1, levelIndex: seasonLength(1) - 1, trophies: [] });

    useAdventure.getState().recordWin('2026-07-05');
    expect(useAdventure.getState().seasonId).toBe(2);
    expect(useAdventure.getState().levelIndex).toBe(0);
    expect(useAdventure.getState().trophies).toContain(1);
    expect(useAdventure.getState().lastWinCompletedSeason).toBe(1);

    useAdventure.getState().recordFail();
    expect(useAdventure.getState().consecutive).toBe(0);
  });

  it('applies the backend Adventure season window without local date math', () => {
    const firstWindow = {
      seasonId: 1,
      serverNowIso: '2026-07-10T12:00:00.000Z',
      windowStartIso: '2026-07-05T21:00:00.000Z',
      windowEndIso: '2026-07-19T21:00:00.000Z',
      durationDays: 14,
    };
    const nextWindow = {
      seasonId: 2,
      serverNowIso: '2026-07-20T12:00:00.000Z',
      windowStartIso: '2026-07-19T21:00:00.000Z',
      windowEndIso: '2026-08-02T21:00:00.000Z',
      durationDays: 14,
    };

    useAdventure.setState({ seasonId: 1, levelIndex: 5, consecutive: 3, trophies: [99] });
    useAdventure.getState().applySeasonWindow(firstWindow);
    expect(useAdventure.getState().levelIndex).toBe(5);
    expect(useAdventure.getState().consecutive).toBe(3);

    useAdventure.getState().applySeasonWindow(nextWindow);
    expect(useAdventure.getState().seasonId).toBe(2);
    expect(useAdventure.getState().levelIndex).toBe(0);
    expect(useAdventure.getState().consecutive).toBe(0);
    expect(useAdventure.getState().trophies).toEqual([99]);
    expect(useAdventure.getState().seasonWindow).toEqual(nextWindow);
  });
});
