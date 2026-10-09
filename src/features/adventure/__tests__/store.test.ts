import { useAdventure } from '../store';
import { KEYS, setJSON, storage } from '@/core/storage';
import { useMascot } from '@/features/mascot/store';
import { levelFor } from '../logic/levels';
import { absoluteLevelNumber, seasonLength } from '../logic/seasons';

const FIRST_WINDOW = {
  seasonId: 1,
  serverNowIso: '2026-07-10T12:00:00.000Z',
  windowStartIso: '2026-07-05T21:00:00.000Z',
  windowEndIso: '2026-07-19T21:00:00.000Z',
  durationDays: 14,
};
const NEXT_WINDOW = {
  seasonId: 2,
  serverNowIso: '2026-07-20T12:00:00.000Z',
  windowStartIso: '2026-07-19T21:00:00.000Z',
  windowEndIso: '2026-08-02T21:00:00.000Z',
  durationDays: 14,
};

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

  it('keeps the unfinished level and win streak when the calendar season changes', () => {
    useAdventure.setState({ seasonId: 1, levelIndex: 5, consecutive: 3, trophies: [99] });
    const levelBefore = levelFor(1, 5);
    useAdventure.getState().applySeasonWindow(FIRST_WINDOW);
    expect(useAdventure.getState().levelIndex).toBe(5);
    expect(useAdventure.getState().consecutive).toBe(3);

    useAdventure.getState().applySeasonWindow(NEXT_WINDOW);
    const state = useAdventure.getState();
    expect(state.seasonId).toBe(1);
    expect(state.levelIndex).toBe(5);
    expect(state.consecutive).toBe(3);
    expect(state.trophies).toEqual([99]);
    expect(state.seasonWindow).toEqual(NEXT_WINDOW);
    expect(levelFor(state.seasonId, state.levelIndex)).toEqual(levelBefore);
    expect(absoluteLevelNumber(state.seasonId, state.levelIndex)).toBe(6);

    state.hydrate();
    expect(useAdventure.getState()).toMatchObject({
      seasonId: 1, levelIndex: 5, consecutive: 3, trophies: [99], seasonWindow: NEXT_WINDOW,
    });
  });

  it('settles the same persisted run outcome only once after remount', () => {
    expect(useAdventure.getState().recordWinOnce('adventure:personal:s1:l1', 'run-1', '2026-07-05')).toBe(true);
    expect(useAdventure.getState().recordWinOnce('adventure:personal:s1:l1', 'run-1', '2026-07-05')).toBe(false);
    expect(useAdventure.getState()).toMatchObject({ levelIndex: 1, consecutive: 1 });

    expect(useAdventure.getState().recordFailOnce('run-2')).toBe(true);
    expect(useAdventure.getState().recordFailOnce('run-2')).toBe(false);
    expect(useAdventure.getState().consecutive).toBe(0);
  });

  it('deduplicates another run/attempt of the same personal campaign level', () => {
    const completionId = 'adventure:personal:s1:l1';
    expect(useAdventure.getState().recordWinOnce(completionId, 'run-a', '2026-07-05')).toBe(true);
    expect(useAdventure.getState().recordWinOnce(completionId, 'run-b', '2026-07-05')).toBe(false);
    expect(useAdventure.getState()).toMatchObject({ levelIndex: 1, consecutive: 1 });
  });

  it('keeps the full completion ledger beyond 500 clears', () => {
    const settledCompletionIds = Array.from(
      { length: 501 },
      (_, index) => `adventure:personal:s${Math.floor(index / 96) + 1}:l${(index % 96) + 1}`,
    );
    useAdventure.setState({ settledCompletionIds });

    expect(useAdventure.getState().recordWinOnce(
      settledCompletionIds[0],
      'new-attempt-of-old-level',
      '2026-07-05',
    )).toBe(false);
    expect(useAdventure.getState().settledCompletionIds).toHaveLength(501);
  });

  it('does not expose a campaign advance when its critical save fails', () => {
    const write = jest.spyOn(storage, 'set').mockImplementationOnce(() => {
      throw new Error('disk unavailable');
    });

    expect(() => useAdventure.getState().recordWinOnce(
      'adventure:personal:s1:l1',
      'run-fail',
      '2026-07-05',
    )).toThrow('disk unavailable');
    expect(useAdventure.getState()).toMatchObject({
      levelIndex: 0,
      consecutive: 0,
      settledCompletionIds: [],
    });
    write.mockRestore();
  });

  it('migrates v1 forward without silently backfilling historical completion XP', () => {
    setJSON(KEYS.adventure, {
      v: 1,
      seasonId: 1,
      levelIndex: 12,
      consecutive: 2,
      daily: { date: '2026-09-18', cleared: 3 },
      trophies: [],
      seasonWindow: null,
      seasonWindowSyncedAtMs: null,
      settledRunIds: ['old-run'],
    });

    useAdventure.getState().hydrate();

    expect(useAdventure.getState()).toMatchObject({
      v: 2,
      seasonId: 1,
      levelIndex: 12,
      settledRunIds: ['old-run'],
      settledCompletionIds: [],
    });
  });

  it('reconciles a season cosmetic from the durable trophy entitlement', () => {
    useMascot.setState({ unlocked: [] });
    setJSON(KEYS.adventure, {
      v: 2,
      seasonId: 2,
      levelIndex: 0,
      consecutive: 1,
      daily: { date: '', cleared: 0 },
      trophies: [1],
      seasonWindow: null,
      seasonWindowSyncedAtMs: null,
      settledRunIds: [],
      settledCompletionIds: ['adventure:personal:s1:l96'],
    });

    useAdventure.getState().hydrate();

    expect(useMascot.getState().unlocked).toContain('acc-jetpack');
  });

  it('starts new players at level one even when the calendar season is far ahead', () => {
    useAdventure.getState().applySeasonWindow({ ...NEXT_WINDOW, seasonId: 15 });
    expect(useAdventure.getState()).toMatchObject({ seasonId: 1, levelIndex: 0, trophies: [] });
  });

  it('keeps completed progress and its celebration when the calendar is behind', () => {
    useAdventure.setState({ seasonId: 3, levelIndex: seasonLength(3) - 1, trophies: [1, 2] });
    useAdventure.getState().recordWin('2026-07-20');
    useAdventure.getState().applySeasonWindow(NEXT_WINDOW);

    expect(useAdventure.getState()).toMatchObject({
      seasonId: 4,
      levelIndex: 0,
      consecutive: 1,
      daily: { date: '2026-07-20', cleared: 1 },
      trophies: [1, 2, 3],
      lastWinCompletedSeason: 3,
      seasonWindow: NEXT_WINDOW,
    });
    useAdventure.getState().ackSeasonCelebration();
    expect(useAdventure.getState().lastWinCompletedSeason).toBeNull();
  });

  it('keeps 95/96 personal progress across a calendar boundary and awards the trophy after it', () => {
    useAdventure.setState({ seasonId: 1, levelIndex: 95, trophies: [] });
    useAdventure.getState().applySeasonWindow(NEXT_WINDOW);
    expect(useAdventure.getState()).toMatchObject({ seasonId: 1, levelIndex: 95, trophies: [] });

    useAdventure.getState().recordWin('2026-07-20');
    expect(useAdventure.getState()).toMatchObject({
      seasonId: 2,
      levelIndex: 0,
      trophies: [1],
      seasonWindow: NEXT_WINDOW,
    });
  });
});
