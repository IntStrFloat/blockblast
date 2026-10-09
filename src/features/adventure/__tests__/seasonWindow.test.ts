import {
  adventureSeasonRemainingMs,
  adventureSeasonWindowNeedsRefresh,
  formatAdventureSeasonRemaining,
} from '../logic/seasonWindow';

describe('adventure season countdown', () => {
  const window = {
    seasonId: 1,
    serverNowIso: '2026-07-06T12:00:00.000Z',
    windowStartIso: '2026-07-05T21:00:00.000Z',
    windowEndIso: '2026-07-19T21:00:00.000Z',
    durationDays: 14,
  };

  it('uses backend serverNow plus local elapsed time after sync', () => {
    const remaining = adventureSeasonRemainingMs(window, 1_000, 30 * 60 * 1000 + 1_000);
    expect(remaining).toBe(Date.parse(window.windowEndIso) - Date.parse(window.serverNowIso) - 30 * 60 * 1000);
    expect(formatAdventureSeasonRemaining(remaining, 'ru')).toBe('Оформление обновится через 13 д 8 ч');
  });

  it('uses neutral copy until a server window is available', () => {
    expect(formatAdventureSeasonRemaining(adventureSeasonRemainingMs(null, null), 'ru'))
      .toBe('Календарное оформление');
  });

  it('refreshes expired, stale, and clock-rollback windows', () => {
    const syncedAt = Date.parse(window.serverNowIso);
    expect(adventureSeasonWindowNeedsRefresh(window, syncedAt, syncedAt + 60_000)).toBe(false);
    expect(adventureSeasonWindowNeedsRefresh(window, syncedAt, syncedAt + 2 * 60 * 60 * 1000)).toBe(true);
    expect(adventureSeasonRemainingMs(window, syncedAt, syncedAt + 2 * 60 * 60 * 1000)).toBeNull();
    expect(adventureSeasonWindowNeedsRefresh(window, syncedAt, syncedAt - 10 * 60 * 1000)).toBe(true);
    expect(adventureSeasonRemainingMs(window, syncedAt, syncedAt - 10 * 60 * 1000)).toBeNull();
  });
});
