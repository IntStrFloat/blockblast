import { bumpStreakWithProtector, canUseProtector } from '../logic';
import type { StreakState } from '../logic';

const base = (over: Partial<StreakState> = {}): StreakState => ({
  lastDay: null,
  count: 0,
  protectorLastUsedDay: null,
  ...over,
});

describe('canUseProtector', () => {
  it('доступен, если ни разу не использовался', () => {
    expect(canUseProtector(base(), '2026-06-20')).toBe(true);
  });
  it('недоступен в пределах perDays, доступен после', () => {
    const s = base({ protectorLastUsedDay: '2026-06-15' });
    expect(canUseProtector(s, '2026-06-20')).toBe(false); // 5 дней < 7
    expect(canUseProtector(s, '2026-06-22')).toBe(true); // 7 дней
  });
});

describe('bumpStreakWithProtector', () => {
  it('тот же день — без изменений', () => {
    const s = base({ lastDay: '2026-06-20', count: 3 });
    expect(bumpStreakWithProtector(s, '2026-06-20')).toEqual(s);
  });

  it('вчера → +1', () => {
    const s = base({ lastDay: '2026-06-19', count: 3 });
    expect(bumpStreakWithProtector(s, '2026-06-20')).toEqual({
      lastDay: '2026-06-20',
      count: 4,
      protectorLastUsedDay: null,
    });
  });

  it('пропуск 1 дня + защитник доступен → +1 и расход защитника', () => {
    const s = base({ lastDay: '2026-06-18', count: 5 });
    expect(bumpStreakWithProtector(s, '2026-06-20')).toEqual({
      lastDay: '2026-06-20',
      count: 6,
      protectorLastUsedDay: '2026-06-20',
    });
  });

  it('пропуск 1 дня, но защитник недавно потрачен → сброс на 1', () => {
    const s = base({ lastDay: '2026-06-18', count: 5, protectorLastUsedDay: '2026-06-17' });
    expect(bumpStreakWithProtector(s, '2026-06-20')).toEqual({
      lastDay: '2026-06-20',
      count: 1,
      protectorLastUsedDay: '2026-06-17',
    });
  });

  it('пропуск 2+ дней → сброс на 1 даже с защитником', () => {
    const s = base({ lastDay: '2026-06-16', count: 9 });
    expect(bumpStreakWithProtector(s, '2026-06-20')).toEqual({
      lastDay: '2026-06-20',
      count: 1,
      protectorLastUsedDay: null,
    });
  });
});
