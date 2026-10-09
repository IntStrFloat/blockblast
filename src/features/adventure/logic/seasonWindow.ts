import { t, type Lang } from '@/core/i18n';
import type { AdventureSeasonWindow } from '@/features/leaderboard/types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const SEASON_WINDOW_REFRESH_MAX_AGE_MS = HOUR_MS;
export const SEASON_WINDOW_CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;

export function adventureSeasonRemainingMs(
  window: AdventureSeasonWindow | null,
  syncedAtMs: number | null,
  nowMs = Date.now(),
): number | null {
  if (!window) return null;
  const serverNowMs = Date.parse(window.serverNowIso);
  const endMs = Date.parse(window.windowEndIso);
  if (!Number.isFinite(serverNowMs) || !Number.isFinite(endMs)) return null;
  if (
    syncedAtMs !== null &&
    nowMs + SEASON_WINDOW_CLOCK_ROLLBACK_TOLERANCE_MS < syncedAtMs
  ) return null;
  if (
    syncedAtMs !== null &&
    nowMs - syncedAtMs >= SEASON_WINDOW_REFRESH_MAX_AGE_MS
  ) return null;
  const elapsedSinceSync = syncedAtMs === null ? 0 : Math.max(0, nowMs - syncedAtMs);
  return Math.max(0, endMs - (serverNowMs + elapsedSinceSync));
}

export function adventureSeasonWindowNeedsRefresh(
  window: AdventureSeasonWindow | null,
  syncedAtMs: number | null,
  nowMs = Date.now(),
): boolean {
  if (!window || syncedAtMs === null) return true;
  if (nowMs + SEASON_WINDOW_CLOCK_ROLLBACK_TOLERANCE_MS < syncedAtMs) return true;
  const remaining = adventureSeasonRemainingMs(window, syncedAtMs, nowMs);
  if (remaining === null || remaining <= 0) return true;
  return nowMs - syncedAtMs >= SEASON_WINDOW_REFRESH_MAX_AGE_MS;
}

export function formatAdventureSeasonRemaining(
  remainingMs: number | null,
  lang: Lang,
  short = false,
): string {
  if (remainingMs === null) return t('adventure.calendarTheme', lang);
  if (remainingMs <= 0) return t('adventure.themeRefreshPending', lang);
  if (remainingMs < HOUR_MS) {
    return short
      ? t('adventure.themeLessHourShort', lang)
      : t('adventure.themeLessHour', lang);
  }

  const days = Math.floor(remainingMs / DAY_MS);
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);
  const duration = days > 0
    ? lang === 'ru' ? days + ' д ' + hours + ' ч' : days + 'd ' + hours + 'h'
    : lang === 'ru' ? hours + ' ч' : hours + 'h';
  return short
    ? t('adventure.themeShort', lang) + ' · ' + duration
    : t('adventure.themeRefreshIn', lang) + ' ' + duration;
}
