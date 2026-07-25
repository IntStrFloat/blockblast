import {
  adventureSeasonRemainingMs,
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
    const remaining = adventureSeasonRemainingMs(window, 1_000, 60 * 60 * 1000 + 1_000);
    expect(remaining).toBe(Date.parse(window.windowEndIso) - Date.parse(window.serverNowIso) - 60 * 60 * 1000);
    expect(formatAdventureSeasonRemaining(remaining)).toBe('Осталось 13 д 8 ч');
  });

  it('shows sync copy until a server window is available', () => {
    expect(formatAdventureSeasonRemaining(adventureSeasonRemainingMs(null, null))).toBe('Обновляем время');
  });
});
