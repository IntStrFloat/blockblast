/**
 * Планировщик локальных уведомлений (retention фаза 4, спека 16).
 * Чистая функция: состояние игрока → список «когда и что» с жёстким лимитом
 * МАКСИМУМ ОДНО уведомление в календарный день (анти-чеклист 06). При конфликте
 * дня побеждает приоритет: стрик > конец турнира > итоги турнира > конец сезона.
 */

export type LocalNotificationKind =
  | 'streak'
  | 'tournamentEnd'
  | 'prizeReady'
  | 'savedRun'
  | 'seasonEnding';

export interface PlannedNotification {
  kind: LocalNotificationKind;
  fireAt: Date;
  params: {
    streakCount?: number;
    rank?: number | null;
    savedMode?: 'classic' | 'adventure';
  };
}

export interface PlannerInput {
  /** Локальная дата YYYY-MM-DD на момент планирования. */
  todayIso: string;
  streak: { lastDay: string | null; count: number };
  protectorAvailable: boolean;
  tournamentPlayedThisWeek: boolean;
  tournamentCurrentRank: number | null;
  prizePlayedTargetWeek: boolean;
  savedRun?: { mode: 'classic' | 'adventure' } | null;
  /** G09 server-owned calendar-theme deadline; personal campaign never expires. */
  adventureThemeWindowEndIso?: string | null;
}

const PRIORITY: Record<LocalNotificationKind, number> = {
  streak: 0,
  tournamentEnd: 1,
  prizeReady: 2,
  savedRun: 3,
  seasonEnding: 4,
};

const STREAK_HOUR = 19;
const TOURNAMENT_END_HOUR = 18;
const PRIZE_HOUR = 11;
const SAVED_RUN_HOUR = 18;

function parseIsoDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function at(day: Date, hour: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
}

function addDays(day: Date, days: number): Date {
  const next = new Date(day);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDays(fromIso: string, toIso: string): number {
  const from = parseIsoDay(fromIso);
  const to = parseIsoDay(toIso);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function planLocalNotifications(input: PlannerInput, now: Date): PlannedNotification[] {
  const candidates: PlannedNotification[] = [];
  const today = parseIsoDay(input.todayIso);

  // 1. Стрик: живой стрик умирает в конце дня без партии — напоминаем в 19:00
  // того дня, когда партия ещё спасает цепочку.
  const { lastDay, count } = input.streak;
  if (lastDay !== null && count >= 1) {
    const gap = diffDays(lastDay, input.todayIso);
    if (gap === 0) {
      // Сыграно сегодня — цепочку спасёт партия завтра.
      candidates.push({
        kind: 'streak',
        fireAt: at(addDays(today, 1), STREAK_HOUR),
        params: { streakCount: count },
      });
    } else if (gap === 1) {
      // Вчера играли, сегодня ещё нет — последний шанс сегодня вечером.
      candidates.push({
        kind: 'streak',
        fireAt: at(today, STREAK_HOUR),
        params: { streakCount: count },
      });
    } else if (gap === 2 && input.protectorAvailable) {
      // Позавчера играли, вчера пропустили, но защитник ещё может спасти цепочку сегодня.
      candidates.push({
        kind: 'streak',
        fireAt: at(today, STREAK_HOUR),
        params: { streakCount: count },
      });
    }
    // gap ≥ 2 без защитника — стрик уже потерян, молчим.
  }

  // 2–3. Турнир: воскресенье 18:00 «заканчивается» только для текущей недели.
  // PrizeReady: в понедельник относится к ТОЛЬКО что завершившейся неделе;
  // в остальные дни наперёд ставится на следующий понедельник по участию в текущей.
  const dow = today.getDay(); // 0 = воскресенье, 1 = понедельник
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  const sunday = addDays(today, daysToSunday);
  if (input.tournamentPlayedThisWeek) {
    candidates.push({
      kind: 'tournamentEnd',
      fireAt: at(sunday, TOURNAMENT_END_HOUR),
      params: { rank: input.tournamentCurrentRank },
    });
  }
  if (input.prizePlayedTargetWeek) {
    const prizeDay = dow === 1 ? today : addDays(sunday, 1);
    candidates.push({
      kind: 'prizeReady',
      fireAt: at(prizeDay, PRIZE_HOUR),
      params: {},
    });
  }

  if (input.savedRun) {
    candidates.push({
      kind: 'savedRun',
      fireAt: at(addDays(today, 1), SAVED_RUN_HOUR),
      params: { savedMode: input.savedRun.mode },
    });
  }

  // G09 deadline changes calendar styling only. Copy explicitly preserves the
  // personal campaign; this is not presented as expiring level progress.
  if (input.adventureThemeWindowEndIso) {
    const deadline = new Date(input.adventureThemeWindowEndIso);
    if (!Number.isNaN(deadline.getTime())) {
      candidates.push({
        kind: 'seasonEnding',
        fireAt: at(addDays(deadline, -1), TOURNAMENT_END_HOUR),
        params: {},
      });
    }
  }

  // Только будущее; лимит 1/день по приоритету.
  const future = candidates.filter((c) => c.fireAt.getTime() > now.getTime());
  future.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);
  const byDay = new Map<string, PlannedNotification>();
  for (const c of future) {
    const key = dayKey(c.fireAt);
    if (!byDay.has(key)) byDay.set(key, c);
  }
  return [...byDay.values()].sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
