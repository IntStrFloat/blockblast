import { useAdventure } from '../store';

const mockGetAdventureSeason = jest.fn<Promise<unknown>, [unknown]>();

jest.mock('@/features/leaderboard/client', () => ({
  createLeaderboardClient: () => ({
    kind: 'remote',
    bootstrapProfile: jest.fn(),
    renameProfile: jest.fn(),
    issueTickets: jest.fn(),
    getWeeklySnapshot: jest.fn(),
    getAdventureSeason: (input: unknown) => mockGetAdventureSeason(input),
    submitRun: jest.fn(),
  }),
}));

const WINDOW = {
  seasonId: 1,
  serverNowIso: '2026-07-06T12:00:00.000Z',
  windowStartIso: '2026-07-05T21:00:00.000Z',
  windowEndIso: '2026-07-19T21:00:00.000Z',
  durationDays: 14,
};

describe('adventure season sync', () => {
  beforeEach(() => {
    mockGetAdventureSeason.mockReset();
    useAdventure.getState().reset();
  });

  it('does not start a second sync while one is in flight', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    mockGetAdventureSeason.mockImplementation(
      () => new Promise((resolve) => (resolveFirst = resolve)),
    );

    const first = useAdventure.getState().syncSeasonWindow('token');
    const second = useAdventure.getState().syncSeasonWindow('token');

    expect(mockGetAdventureSeason).toHaveBeenCalledTimes(1);
    expect(await second).toBeNull();

    resolveFirst(WINDOW);
    expect(await first).toEqual(WINDOW);
    expect(useAdventure.getState().seasonWindow).toEqual(WINDOW);
    expect(useAdventure.getState().syncStatus).toBe('ready');
  });

  it('marks status as error when the request fails', async () => {
    mockGetAdventureSeason.mockRejectedValue(new Error('request_failed:404'));

    const result = await useAdventure.getState().syncSeasonWindow('token');

    expect(result).toBeNull();
    expect(useAdventure.getState().syncStatus).toBe('error');
    expect(useAdventure.getState().seasonWindow).toBeNull();
    expect(useAdventure.getState().seasonWindowFailureCount).toBe(1);
    expect(useAdventure.getState().seasonWindowRetryAtMs).toEqual(expect.any(Number));
  });

  it('bounds retries and preserves the last known window while offline', async () => {
    const nowMs = Date.parse('2026-07-20T12:00:00.000Z');
    useAdventure.setState({
      seasonWindow: WINDOW,
      seasonWindowSyncedAtMs: Date.parse(WINDOW.serverNowIso),
      seasonWindowRetryAtMs: null,
      seasonWindowFailureCount: 0,
    });
    mockGetAdventureSeason.mockRejectedValue(new Error('offline'));

    await useAdventure.getState().syncSeasonWindow('token', { nowMs });
    const retryAt = useAdventure.getState().seasonWindowRetryAtMs!;
    await useAdventure.getState().syncSeasonWindow('token', { nowMs: retryAt - 1 });
    expect(mockGetAdventureSeason).toHaveBeenCalledTimes(1);

    await useAdventure.getState().syncSeasonWindow('token', { nowMs: retryAt });
    expect(mockGetAdventureSeason).toHaveBeenCalledTimes(2);
    expect(useAdventure.getState().seasonWindow).toEqual(WINDOW);
  });

  it('refreshes an expired visual window without changing personal progress', async () => {
    const nextWindow = {
      ...WINDOW,
      seasonId: 2,
      serverNowIso: '2026-07-20T12:00:00.000Z',
      windowStartIso: '2026-07-19T21:00:00.000Z',
      windowEndIso: '2026-08-02T21:00:00.000Z',
    };
    useAdventure.setState({
      seasonId: 1,
      levelIndex: 95,
      trophies: [],
      seasonWindow: WINDOW,
      seasonWindowSyncedAtMs: Date.parse(WINDOW.serverNowIso),
    });
    mockGetAdventureSeason.mockResolvedValue(nextWindow);

    await useAdventure.getState().syncSeasonWindow('token', {
      nowMs: Date.parse(nextWindow.serverNowIso),
    });

    expect(useAdventure.getState()).toMatchObject({
      seasonId: 1,
      levelIndex: 95,
      trophies: [],
      seasonWindow: { seasonId: 2 },
    });
  });

  it('preserves wins recorded while a new calendar setting is loading', async () => {
    let resolveWindow: (value: unknown) => void = () => {};
    mockGetAdventureSeason.mockImplementation(
      () => new Promise((resolve) => (resolveWindow = resolve)),
    );
    useAdventure.setState({ seasonId: 1, levelIndex: 8, consecutive: 2 });

    const sync = useAdventure.getState().syncSeasonWindow('token');
    useAdventure.getState().recordWin('2026-07-20');
    resolveWindow({ ...WINDOW, seasonId: 2 });
    await sync;

    expect(useAdventure.getState()).toMatchObject({
      seasonId: 1,
      levelIndex: 9,
      consecutive: 3,
      daily: { date: '2026-07-20', cleared: 1 },
      seasonWindow: { seasonId: 2 },
    });
  });
});
