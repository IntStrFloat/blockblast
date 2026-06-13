import { weeklyStatusLabel } from '../presentation';

describe('weeklyStatusLabel', () => {
  it('hides status copy for current remote data', () => {
    expect(weeklyStatusLabel('ready', 'remote', 'ru')).toBeNull();
  });

  it('describes cached data as saved results', () => {
    expect(weeklyStatusLabel('cached', 'remote', 'ru')).toBe('Сохранённые результаты');
    expect(weeklyStatusLabel('cached', 'remote', 'en')).toBe('Saved results');
  });

  it('shows a player-facing offline label for local data', () => {
    expect(weeklyStatusLabel('empty', 'local', 'ru')).toBe('Без подключения');
    expect(weeklyStatusLabel('empty', 'local', 'en')).toBe('Offline');
  });
});
