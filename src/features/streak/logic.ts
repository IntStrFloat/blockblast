export interface StreakState {
  /** Локальная дата YYYY-MM-DD последнего дня с партией */
  lastDay: string | null;
  count: number;
  /** Локальная дата YYYY-MM-DD последнего срабатывания защитника стрика */
  protectorLastUsedDay?: string | null;
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

/** Защитник доступен, если ни разу не использовался или прошло >= perDays дней. */
export function canUseProtector(state: StreakState, today: string, perDays = 7): boolean {
  const last = state.protectorLastUsedDay ?? null;
  if (last === null) return true;
  return diffDays(last, today) >= perDays;
}

/**
 * Засчитать партию с учётом защитника стрика (1 прощённый пропуск на perDays дней).
 * Тот же день — без изменений; вчера — +1; пропуск одного дня при доступном защитнике —
 * +1 и расход защитника; больше — сброс на 1. Прогресс (count) при сбросе не «штрафует» иное состояние.
 */
export function bumpStreakWithProtector(
  prev: StreakState,
  today: string,
  perDays = 7,
): StreakState {
  const protectorLastUsedDay = prev.protectorLastUsedDay ?? null;
  if (prev.lastDay === today) {
    return { lastDay: prev.lastDay, count: prev.count, protectorLastUsedDay };
  }
  if (prev.lastDay !== null) {
    const d = diffDays(prev.lastDay, today);
    if (d === 1) {
      return { lastDay: today, count: prev.count + 1, protectorLastUsedDay };
    }
    if (d === 2 && canUseProtector(prev, today, perDays)) {
      return { lastDay: today, count: prev.count + 1, protectorLastUsedDay: today };
    }
  }
  return { lastDay: today, count: 1, protectorLastUsedDay };
}
