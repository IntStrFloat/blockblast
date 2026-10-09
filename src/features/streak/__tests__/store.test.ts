import { useAnalyticsStore } from '@/features/analytics';

import { todayISO } from '../logic';
import { useStreak } from '../store';

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return todayISO(d);
}

beforeEach(() => {
  useAnalyticsStore.setState({ queue: [], optOut: false });
});

describe('useStreak.markPlayedToday — событие streak_lost', () => {
  it('сброс живого стрика (пропуск > защитника) трекает streak_lost с прежней длиной', () => {
    useStreak.setState({ lastDay: daysAgoISO(5), count: 6, protectorLastUsedDay: null });
    useStreak.getState().markPlayedToday();
    expect(useStreak.getState().count).toBe(1);
    expect(useAnalyticsStore.getState().queue).toEqual([
      expect.objectContaining({ name: 'streak_lost', properties: { count: 6 } }),
    ]);
  });

  it('продление стрика (вчера) не трекает', () => {
    useStreak.setState({ lastDay: daysAgoISO(1), count: 3, protectorLastUsedDay: null });
    useStreak.getState().markPlayedToday();
    expect(useStreak.getState().count).toBe(4);
    expect(useAnalyticsStore.getState().queue).toEqual([]);
  });

  it('спасение защитником (пропуск 1 дня) не трекает', () => {
    useStreak.setState({ lastDay: daysAgoISO(2), count: 3, protectorLastUsedDay: null });
    useStreak.getState().markPlayedToday();
    expect(useStreak.getState().count).toBe(4);
    expect(useAnalyticsStore.getState().queue).toEqual([
      expect.objectContaining({ name: 'streak_protector_saved', properties: { count: 4 } }),
    ]);
  });

  it('первый день (count 0/1) не трекает потерю', () => {
    useStreak.setState({ lastDay: null, count: 0, protectorLastUsedDay: null });
    useStreak.getState().markPlayedToday();
    expect(useAnalyticsStore.getState().queue).toEqual([]);
  });

  it('повторная партия в тот же день не трекает', () => {
    useStreak.setState({ lastDay: todayISO(), count: 5, protectorLastUsedDay: null });
    useStreak.getState().markPlayedToday();
    expect(useAnalyticsStore.getState().queue).toEqual([]);
  });

  it('спасение защитником логируется ровно один раз на фактическое восстановление', () => {
    useStreak.setState({ lastDay: daysAgoISO(2), count: 7, protectorLastUsedDay: null });
    useStreak.getState().markPlayedToday();
    useStreak.getState().markPlayedToday();
    expect(
      useAnalyticsStore.getState().queue.filter((event) => event.name === 'streak_protector_saved'),
    ).toHaveLength(1);
  });
});
