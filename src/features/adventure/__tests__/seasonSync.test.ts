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

import { useAdventure } from '../store';

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
  });
});
