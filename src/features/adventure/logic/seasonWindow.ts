import type { AdventureSeasonWindow } from '@/features/leaderboard/types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function adventureSeasonRemainingMs(
  window: AdventureSeasonWindow | null,
  syncedAtMs: number | null,
  nowMs = Date.now(),
): number | null {
  if (!window) return null;
  const serverNowMs = Date.parse(window.serverNowIso);
  const endMs = Date.parse(window.windowEndIso);
  if (!Number.isFinite(serverNowMs) || !Number.isFinite(endMs)) return null;
  const elapsedSinceSync = syncedAtMs === null ? 0 : Math.max(0, nowMs - syncedAtMs);
  return Math.max(0, endMs - (serverNowMs + elapsedSinceSync));
}

export function formatAdventureSeasonRemaining(remainingMs: number | null): string {
  if (remainingMs === null) return 'Обновляем время';
  if (remainingMs <= 0) return 'Сезон завершается';
  if (remainingMs < HOUR_MS) return 'Осталось меньше часа';

  const days = Math.floor(remainingMs / DAY_MS);
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);
  if (days > 0) return `Осталось ${days} д ${hours} ч`;
  return `Осталось ${hours} ч`;
}
