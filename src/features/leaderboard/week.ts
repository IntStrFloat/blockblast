const LEADERBOARD_UTC_OFFSET_MINUTES = 3 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export function getUtcWeekWindow(now: Date) {
  const offsetMs = LEADERBOARD_UTC_OFFSET_MINUTES * 60 * 1000;
  const date = new Date(now.getTime() + offsetMs);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const localWeekStart = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - diffToMonday,
  );
  const weekStart = localWeekStart - offsetMs;
  const weekEnd = weekStart + MS_PER_WEEK;
  return {
    weekKey: new Date(localWeekStart).toISOString().slice(0, 10),
    weekStartIso: new Date(weekStart).toISOString(),
    weekEndIso: new Date(weekEnd).toISOString(),
  };
}

export function getUtcWeekCountdown(now: Date) {
  const { weekEndIso } = getUtcWeekWindow(now);
  const totalMs = Math.max(0, new Date(weekEndIso).getTime() - now.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function getWeeklyGoal(current: number, assignedTarget = 1500) {
  const progress = Math.max(0, Math.floor(current));
  const target = Math.max(500, Math.floor(assignedTarget));
  return {
    current: progress,
    target,
    progress,
    remaining: Math.max(0, target - progress),
    complete: progress >= target,
  };
}
