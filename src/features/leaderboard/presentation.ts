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

const MAX_RENDERED_ENTRIES = 100;

/** Порядок таблицы зеркалит серверный buildSnapshot: рекорд ↓, партии ↑, время ↑. */
function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return (
    b.weeklyBest - a.weeklyBest ||
    a.runsCount - b.runsCount ||
    String(a.achievedAt).localeCompare(String(b.achievedAt))
  );
}

/**
 * Разрешённое представление недельного рейтинга — ЕДИНЫЙ источник истины и для
 * героя-рекорда, и для списка, и для строки текущего игрока.
 *
 * Раньше рекорд считался по max(сервер, локальный), а список и место брались
 * только из серверного снапшота — поэтому карточка показывала рекорд, а в списке
 * игрока не было («Без ранга»), пока сабмит не подтверждён (оффлайн/в очереди/
 * отклонён). Здесь мы всегда вписываем текущего игрока в таблицу по тому же
 * effectiveBest и пересчитываем места, так что «рекорд» и «строка в списке» не
 * расходятся. Как только сервер подтверждает рекорд — ветка становится
 * серверо-авторитетной и значения сходятся к официальным.
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

  // Нет идентичности игрока (снапшота ещё нет) — рекорд показать можем, строку нет.
  if (!serverPlayer) {
    return {
      effectiveBest,
      rank: null,
      pending: effectiveBest > 0,
      currentEntry: null,
      entries: serverEntries.map(withChampion),
    };
  }

  // Рекорда ещё нет — серверный список как есть, без строки игрока.
  if (effectiveBest === 0) {
    return {
      effectiveBest: 0,
      rank: null,
      pending: false,
      currentEntry: null,
      entries: serverEntries.map(withChampion),
    };
  }

  const serverConfirmsBest =
    serverPlayer.rank !== null && serverPlayer.weeklyBest >= effectiveBest;

  // Сервер уже подтвердил рекорд (он не ниже локального) — доверяем серверу.
  if (serverConfirmsBest) {
    const entries = serverEntries.map(withChampion);
    const currentEntry = entries.find((e) => e.isCurrentPlayer) ?? withChampion({ ...serverPlayer });
    return { effectiveBest, rank: serverPlayer.rank, pending: false, currentEntry, entries };
  }

  // Локальный рекорд выше подтверждённого (оффлайн/в очереди/отклонён): вписываем
  // игрока в таблицу по effectiveBest и пересчитываем места — провизорно, до синка.
  const weekKey = getUtcWeekWindow(now).weekKey;
  const localRuns = localWeekly?.weekKey === weekKey ? localWeekly.runsCount : 0;
  const localAchievedAt = localWeekly?.weekKey === weekKey ? localWeekly.achievedAt : null;
  const others = serverEntries.filter((e) => !e.isCurrentPlayer);
  const draft: LeaderboardEntry = {
    nickname: serverPlayer.nickname,
    tag: serverPlayer.tag,
    rank: null,
    weeklyBest: effectiveBest,
    runsCount: Math.max(serverPlayer.runsCount, localRuns),
    achievedAt: localAchievedAt ?? serverPlayer.achievedAt,
    isCurrentPlayer: true,
    championRank,
  };
  const entries = [...others, draft]
    .sort(compareEntries)
    .slice(0, MAX_RENDERED_ENTRIES)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const ranked = entries.find((e) => e.isCurrentPlayer) ?? null;
  // Если игрок не попал в отрисованный топ-100 — оценка по числу записей выше.
  const rank = ranked?.rank ?? others.filter((e) => e.weeklyBest > effectiveBest).length + 1;

  return {
    effectiveBest,
    rank,
    pending: true,
    currentEntry: ranked ?? { ...draft, rank },
    entries,
  };
}
