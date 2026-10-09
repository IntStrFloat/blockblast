declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const read = (path: string) => fs.readFileSync(`${__dirname}/${path}`, 'utf8');

describe('G09 Adventure window contract', () => {
  it('names the calendar theme and never promises an expiring trophy', () => {
    const ru = read('../../core/i18n/ru.ts');
    const en = read('../../core/i18n/en.ts');
    const countdown = read('../../features/adventure/logic/seasonWindow.ts');
    expect(ru).toContain("themeRefreshIn: 'Оформление обновится через'");
    expect(en).toContain("themeRefreshIn: 'Theme refreshes in'");
    expect(ru).not.toContain('Осталось 2 дня, чтобы собрать мозаику');
    expect(en).not.toContain('2 days left to finish the mosaic');
    expect(countdown).not.toContain('Сезон завершается');
  });

  it('hides the bright Home ribbon until a trustworthy window exists', () => {
    const home = read('../index.tsx');
    expect(home).toContain('ribbon={adventureSeasonRemaining !== null');
    expect(home).toContain('adventureSeasonRemaining > 0');
    expect(home).toContain(': undefined}');
  });

  it('disables false season-ending eligibility without losing legacy cleanup', () => {
    const planner = read('../../features/notifications/local/planner.ts');
    const hook = read('../../features/notifications/local/useLocalNotifications.ts');
    const scheduler = read('../../features/notifications/local/scheduler.ts');
    expect(planner).not.toContain('seasonCompleted: boolean');
    expect(hook).not.toContain('seasonCompleted: false');
    expect(scheduler).toContain("seasonEnding: `${IDENTIFIER_PREFIX}seasonEnding`");
  });

  it('records the actual permission result and notification target action', () => {
    const prompt = read('../../features/notifications/HomePromptHost.tsx');
    const permissions = read('../../features/notifications/permissions.ts');
    const adventure = read('../adventure.tsx');
    expect(prompt).toContain("requestNotificationPermissions('soft_ask')");
    expect(permissions).toContain("track('notification_permission_result'");
    expect(permissions).toContain("local = await requestLocalNotificationPermission()");
    expect(adventure).toContain("recordNotificationTargetViewed('/adventure')");
    expect(adventure).toContain("recordNotificationTargetAction('start_adventure_level')");
  });
});
