import { detectOvertake } from '../presentation';
import type { LeaderboardEntry, WeeklyLeaderboardSnapshot } from '../types';

const WEEK_KEY = '2026-06-15';

function entry(
  p: Partial<LeaderboardEntry> & { tag: string; weeklyBest: number },
): LeaderboardEntry {
  return {
    nickname: p.nickname ?? p.tag,
    tag: p.tag,
    rank: p.rank ?? null,
    weeklyBest: p.weeklyBest,
    runsCount: p.runsCount ?? 1,
    achievedAt: p.achievedAt ?? null,
    isCurrentPlayer: p.isCurrentPlayer ?? false,
  };
}

function snapshot(
  currentPlayer: LeaderboardEntry,
  entries: LeaderboardEntry[],
  weekKey = WEEK_KEY,
): WeeklyLeaderboardSnapshot {
  return {
    weekKey,
    weekStartIso: '2026-06-15T00:00:00.000Z',
    weekEndIso: '2026-06-22T00:00:00.000Z',
    generatedAt: '2026-06-18T12:00:00.000Z',
    source: 'remote',
    isCached: false,
    currentPlayer,
    entries,
  };
}

describe('detectOvertake — момент «тебя обогнали»', () => {
  const meAt = (rank: number) =>
    entry({ tag: 'ME', weeklyBest: 500, rank, isCurrentPlayer: true });

  it('падение места в одной неделе → инфо с ником соседа сверху', () => {
    const prev = snapshot(meAt(2), [entry({ tag: 'A', weeklyBest: 900, rank: 1 }), meAt(2)]);
    const next = snapshot(meAt(3), [
      entry({ tag: 'A', weeklyBest: 900, rank: 1 }),
      entry({ nickname: 'NovaStar', tag: 'B', weeklyBest: 600, rank: 2 }),
      meAt(3),
    ]);
    expect(detectOvertake(prev, next)).toEqual({ by: 'NovaStar', from: 2, to: 3 });
  });

  it('сосед сверху вне топа → by null, но факт падения фиксируется', () => {
    const prev = snapshot(meAt(4), []);
    const next = snapshot(meAt(6), []);
    expect(detectOvertake(prev, next)).toEqual({ by: null, from: 4, to: 6 });
  });

  it('улучшение или то же место → null', () => {
    expect(detectOvertake(snapshot(meAt(3), []), snapshot(meAt(3), []))).toBeNull();
    expect(detectOvertake(snapshot(meAt(3), []), snapshot(meAt(2), []))).toBeNull();
  });

  it('смена недели → null (новая гонка, не обгон)', () => {
    const prev = snapshot(meAt(2), [], '2026-06-08');
    const next = snapshot(meAt(9), [], WEEK_KEY);
    expect(detectOvertake(prev, next)).toBeNull();
  });

  it('нет ранга (до/после) или нет снапшота → null', () => {
    expect(detectOvertake(null, snapshot(meAt(2), []))).toBeNull();
    expect(detectOvertake(snapshot(meAt(2), []), null)).toBeNull();
    expect(
      detectOvertake(snapshot(entry({ tag: 'ME', weeklyBest: 0, isCurrentPlayer: true }), []), snapshot(meAt(5), [])),
    ).toBeNull();
  });
});
