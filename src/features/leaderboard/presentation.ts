import { t, type Lang } from '@/core/i18n';

import type {
  LeaderboardEntry,
  LeaderboardViewState,
  LocalWeeklyResult,
  WeeklyLeaderboardSnapshot,
} from './types';
import { getUtcWeekWindow } from './week';
import { championRankOf, type WeeklyPrizeRecord } from './weeklyPrize';

export function weeklyStatusLabel(
  viewState: LeaderboardViewState,
  source: WeeklyLeaderboardSnapshot['source'] | undefined,
  lang: Lang,
): string | null {
  if (viewState === 'cached') return t('leaderboard.savedResults', lang);
  if (source !== 'remote') return t('leaderboard.offline', lang);
  return null;
}

/**
 * Недельный рекорд для показа: максимум из подтверждённого серверного и локального
 * результата ТЕКУЩЕЙ недели. Иначе оффлайн/без бэкенда (или пока сабмит в очереди)
 * экран показывал 0, хотя игрок уже набрал очки. Единый источник для Home-карточки
 * и экрана рейтинга — раньше экран читал только snapshot и терял локальный рекорд.
 */
export function selectEffectiveWeeklyBest(
  snapshot: WeeklyLeaderboardSnapshot | null,
  localWeekly: LocalWeeklyResult | null,
  now: Date = new Date(),
): number {
  const weekKey = getUtcWeekWindow(now).weekKey;
  const localBest = localWeekly?.weekKey === weekKey ? localWeekly.bestScore : 0;
  return Math.max(snapshot?.currentPlayer.weeklyBest ?? 0, localBest);
}

/** Лучшее призовое место текущего игрока среди полученных призов — драйвер рамки. */
export function selectMyChampionRank(prizes: readonly WeeklyPrizeRecord[]): number | null {
  return championRankOf(prizes.filter((record) => record.claimed));
}

/**
 * Разрешённое представление недельного рейтинга.
 *
 * ИНВАРИАНТ КОНСИСТЕНТНОСТИ: список (`entries`) и места — ВСЕГДА серверные, то есть
 * буквально одинаковые у всех игроков. Локальный рекорд влияет только на карточку
 * «твой рекорд» (`effectiveBest`) и личную закреплённую строку (`currentEntry`),
 * пока сервер не подтвердил результат. Раньше список достраивался локальным
 * рекордом с провизорным местом — из-за этого владелец видел себя выше, чем все
 * остальные. Теперь такого расхождения нет: как только сервер подтверждает рекорд,
 * `pending` гаснет и карточка сходится к официальной строке.
 */
export interface ResolvedWeeklyView {
  /** Недельный рекорд для показа = max(серверный, локальный текущей недели). */
  effectiveBest: number;
  /** Место для показа: серверное, либо провизорное (по effectiveBest) до синка. */
  rank: number | null;
  /** true, пока показанный рекорд/место ещё не подтверждены сервером. */
  pending: boolean;
  /** Строка текущего игрока (с championRank); null, если рекорда ещё нет. */
  currentEntry: LeaderboardEntry | null;
  /** Список для отрисовки: серверные записи + текущий игрок, отсортированы. */
  entries: LeaderboardEntry[];
}

export function resolveWeeklyView(
  snapshot: WeeklyLeaderboardSnapshot | null,
  localWeekly: LocalWeeklyResult | null,
  championRank: number | null,
  now: Date = new Date(),
): ResolvedWeeklyView {
  const effectiveBest = selectEffectiveWeeklyBest(snapshot, localWeekly, now);
  const serverEntries = snapshot?.entries ?? [];
  const serverPlayer = snapshot?.currentPlayer ?? null;

  // championRank рисуем на строке текущего игрока, где бы она ни была.
  const withChampion = (entry: LeaderboardEntry): LeaderboardEntry =>
    entry.isCurrentPlayer ? { ...entry, championRank } : entry;

  // ЛЕНТА ВСЕГДА СЕРВЕРНАЯ — буквально одинаковая у всех игроков (включая строку
  // самого игрока). Локальный рекорд НИКОГДА не вписывается в список и не двигает
  // места; он влияет только на карточку «твой рекорд» (effectiveBest) и на
  // личную закреплённую строку, пока сервер не подтвердил результат.
  const entries = serverEntries.map(withChampion);

  // Нет идентичности игрока (снапшота ещё нет) — рекорд показать можем, строки нет.
  if (!serverPlayer) {
    return { effectiveBest, rank: null, pending: effectiveBest > 0, currentEntry: null, entries };
  }

  // Рекорда ещё нет — серверный список как есть, без строки игрока.
  if (effectiveBest === 0) {
    return { effectiveBest: 0, rank: null, pending: false, currentEntry: null, entries };
  }

  const serverRow = entries.find((e) => e.isCurrentPlayer) ?? null;
  const serverConfirmsBest =
    serverPlayer.rank !== null && serverPlayer.weeklyBest >= effectiveBest;

  // Сервер уже подтвердил рекорд (он не ниже локального) — место и строка серверные.
  if (serverConfirmsBest) {
    return {
      effectiveBest,
      rank: serverPlayer.rank,
      pending: false,
      currentEntry: serverRow ?? withChampion({ ...serverPlayer }),
      entries,
    };
  }

  // Локальный рекорд выше подтверждённого (оффлайн / в очереди / ещё не синканный):
  // СПИСОК не трогаем (только сервер), место показываем СЕРВЕРНОЕ (может быть null =
  // «ещё не в рейтинге») — фейковое место не выдумываем. Локальный рекорд несёт лишь
  // личная карточка/закреплённая строка, помеченная как ожидающая синхрон.
  const weekKey = getUtcWeekWindow(now).weekKey;
  const localRuns = localWeekly?.weekKey === weekKey ? localWeekly.runsCount : 0;
  const localAchievedAt = localWeekly?.weekKey === weekKey ? localWeekly.achievedAt : null;
  const pendingEntry: LeaderboardEntry = {
    nickname: serverPlayer.nickname,
    tag: serverPlayer.tag,
    rank: serverPlayer.rank,
    weeklyBest: effectiveBest,
    runsCount: Math.max(serverPlayer.runsCount, localRuns),
    achievedAt: localAchievedAt ?? serverPlayer.achievedAt,
    isCurrentPlayer: true,
    championRank,
  };

  return {
    effectiveBest,
    rank: serverPlayer.rank,
    pending: true,
    currentEntry: pendingEntry,
    entries,
  };
}
