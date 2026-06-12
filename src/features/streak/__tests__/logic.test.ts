import { bumpStreak, isStreakAlive, todayISO } from '../logic';

describe('bumpStreak', () => {
  it('первый раз → 1', () => {
    expect(bumpStreak({ lastDay: null, count: 0 }, '2026-06-12')).toEqual({
      lastDay: '2026-06-12',
      count: 1,
    });
  });

  it('тот же день — идемпотентно', () => {
    const s = { lastDay: '2026-06-12', count: 3 };
    expect(bumpStreak(s, '2026-06-12')).toEqual(s);
  });

  it('вчера → +1', () => {
    expect(bumpStreak({ lastDay: '2026-06-11', count: 3 }, '2026-06-12')).toEqual({
      lastDay: '2026-06-12',
      count: 4,
    });
  });

  it('пропуск дня → сброс на 1', () => {
    expect(bumpStreak({ lastDay: '2026-06-10', count: 9 }, '2026-06-12')).toEqual({
      lastDay: '2026-06-12',
      count: 1,
    });
  });

  it('границы месяца и года', () => {
    expect(bumpStreak({ lastDay: '2026-02-28', count: 1 }, '2026-03-01').count).toBe(2);
    expect(bumpStreak({ lastDay: '2025-12-31', count: 5 }, '2026-01-01').count).toBe(6);
    // 2028 — високосный: 28.02 → 01.03 НЕ соседние
    expect(bumpStreak({ lastDay: '2028-02-28', count: 5 }, '2028-03-01').count).toBe(1);
    expect(bumpStreak({ lastDay: '2028-02-29', count: 5 }, '2028-03-01').count).toBe(6);
  });
});

describe('isStreakAlive', () => {
  it('сегодня/вчера — жив, раньше — нет', () => {
    expect(isStreakAlive({ lastDay: '2026-06-12', count: 2 }, '2026-06-12')).toBe(true);
    expect(isStreakAlive({ lastDay: '2026-06-11', count: 2 }, '2026-06-12')).toBe(true);
    expect(isStreakAlive({ lastDay: '2026-06-10', count: 2 }, '2026-06-12')).toBe(false);
    expect(isStreakAlive({ lastDay: null, count: 0 }, '2026-06-12')).toBe(false);
  });
});

describe('todayISO', () => {
  it('формат YYYY-MM-DD', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
