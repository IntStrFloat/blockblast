import { resolveWeeklyView } from '../presentation';
import type { LeaderboardEntry, LocalWeeklyResult, WeeklyLeaderboardSnapshot } from '../types';

// Четверг недели 2026-06-15..06-22 (UTC week начинается с понедельника).
const NOW = new Date('2026-06-18T12:00:00.000Z');
const WEEK_KEY = '2026-06-15';

function entry(p: Partial<LeaderboardEntry> & { tag: string; weeklyBest: number }): LeaderboardEntry {
  return {
    nickname: p.nickname ?? p.tag,
    tag: p.tag,
    rank: p.rank ?? null,
    weeklyBest: p.weeklyBest,
    runsCount: p.runsCount ?? 1,
    achievedAt: p.achievedAt ?? null,
    isCurrentPlayer: p.isCurrentPlayer ?? false,
    championRank: p.championRank,
  };
}

function snapshot(
  currentPlayer: LeaderboardEntry,
  entries: LeaderboardEntry[],
): WeeklyLeaderboardSnapshot {
  return {
    weekKey: WEEK_KEY,
    weekStartIso: '2026-06-15T00:00:00.000Z',
    weekEndIso: '2026-06-22T00:00:00.000Z',
    generatedAt: NOW.toISOString(),
    source: 'remote',
    isCached: false,
    currentPlayer,
    entries,
  };
}

function local(bestScore: number, runsCount = 1, weekKey = WEEK_KEY): LocalWeeklyResult {
  return { weekKey, bestScore, runsCount, achievedAt: NOW.toISOString() };
}

describe('resolveWeeklyView — единый источник истины рекорда и списка', () => {
  it('доверяет серверу, когда серверный рекорд подтверждает локальный', () => {
    const me = entry({ tag: 'ME', weeklyBest: 500, rank: 2, isCurrentPlayer: true, runsCount: 3 });
    const snap = snapshot(me, [
      entry({ tag: 'A', weeklyBest: 1000, rank: 1 }),
      me,
      entry({ tag: 'B', weeklyBest: 300, rank: 3 }),
    ]);

    const view = resolveWeeklyView(snap, local(400), null, NOW);

    expect(view.effectiveBest).toBe(500);
    expect(view.rank).toBe(2);
    expect(view.pending).toBe(false);
    expect(view.entries).toHaveLength(3);
    expect(view.entries.find((e) => e.isCurrentPlayer)?.weeklyBest).toBe(500);
    expect(view.currentEntry?.rank).toBe(2);
  });

  it('вставляет игрока в список по локальному рекорду, когда сервер его ещё не ранжировал', () => {
    const me = entry({ tag: 'ME', nickname: 'Me', weeklyBest: 0, rank: null, isCurrentPlayer: true, runsCount: 0 });
    const snap = snapshot(me, [
      entry({ tag: 'A', weeklyBest: 1000, rank: 1 }),
      entry({ tag: 'B', weeklyBest: 800, rank: 2 }),
      entry({ tag: 'C', weeklyBest: 300, rank: 3 }),
    ]);

    const view = resolveWeeklyView(snap, local(600, 4), 1, NOW);

    expect(view.effectiveBest).toBe(600);
    expect(view.pending).toBe(true);
    expect(view.rank).toBe(3);
    expect(view.entries.map((e) => e.tag)).toEqual(['A', 'B', 'ME', 'C']);
    expect(view.entries.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
    const mine = view.entries.find((e) => e.isCurrentPlayer)!;
    expect(mine.weeklyBest).toBe(600);
    expect(mine.runsCount).toBe(4);
    expect(mine.championRank).toBe(1);
    expect(view.currentEntry?.tag).toBe('ME');
  });

  it('не дублирует игрока: переносит уже ранжированную строку на новый локальный рекорд', () => {
    const me = entry({ tag: 'ME', weeklyBest: 200, rank: 3, isCurrentPlayer: true });
    const snap = snapshot(me, [
      entry({ tag: 'A', weeklyBest: 1000, rank: 1 }),
      entry({ tag: 'B', weeklyBest: 800, rank: 2 }),
      me,
    ]);

    const view = resolveWeeklyView(snap, local(900), null, NOW);

    expect(view.effectiveBest).toBe(900);
    expect(view.pending).toBe(true);
    expect(view.entries.map((e) => e.tag)).toEqual(['A', 'ME', 'B']);
    expect(view.entries.filter((e) => e.isCurrentPlayer)).toHaveLength(1);
    expect(view.rank).toBe(2);
  });

  it('без рекорда не показывает строку игрока и оставляет список сервера', () => {
    const me = entry({ tag: 'ME', weeklyBest: 0, rank: null, isCurrentPlayer: true, runsCount: 0 });
    const snap = snapshot(me, [entry({ tag: 'A', weeklyBest: 1000, rank: 1 })]);

    const view = resolveWeeklyView(snap, null, null, NOW);

    expect(view.effectiveBest).toBe(0);
    expect(view.rank).toBeNull();
    expect(view.pending).toBe(false);
    expect(view.currentEntry).toBeNull();
    expect(view.entries).toHaveLength(1);
  });

  it('без снапшота отдаёт локальный рекорд как ожидающий синхронизации', () => {
    const view = resolveWeeklyView(null, local(700), null, NOW);

    expect(view.effectiveBest).toBe(700);
    expect(view.rank).toBeNull();
    expect(view.currentEntry).toBeNull();
    expect(view.entries).toEqual([]);
    expect(view.pending).toBe(true);
  });

  it('игнорирует локальный рекорд прошлой недели', () => {
    const me = entry({ tag: 'ME', weeklyBest: 500, rank: 2, isCurrentPlayer: true });
    const snap = snapshot(me, [entry({ tag: 'A', weeklyBest: 1000, rank: 1 }), me]);
    const stale = local(9999, 1, '2026-06-08');

    const view = resolveWeeklyView(snap, stale, null, NOW);

    expect(view.effectiveBest).toBe(500);
    expect(view.pending).toBe(false);
    expect(view.rank).toBe(2);
  });
});
