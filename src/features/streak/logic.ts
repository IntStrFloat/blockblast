export interface StreakState {
  /** Локальная дата YYYY-MM-DD последнего дня с партией */
  lastDay: string | null;
  count: number;
}

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffDays(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

/** Сыграна партия в день today: тот же день — без изменений, вчера — +1, иначе — заново с 1. */
export function bumpStreak(prev: StreakState, today: string): StreakState {
  if (prev.lastDay === today) return prev;
  if (prev.lastDay !== null && diffDays(prev.lastDay, today) === 1) {
    return { lastDay: today, count: prev.count + 1 };
  }
  return { lastDay: today, count: 1 };
}

/** Стрик «жив», если последняя партия сегодня или вчера. */
export function isStreakAlive(state: StreakState, today: string): boolean {
  if (state.lastDay === null) return false;
  const d = diffDays(state.lastDay, today);
  return d === 0 || d === 1;
}
