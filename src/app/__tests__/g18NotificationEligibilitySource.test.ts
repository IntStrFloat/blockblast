declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const home = fs.readFileSync(`${__dirname}/../index.tsx`, 'utf8');
const prompt = fs.readFileSync(
  `${__dirname}/../../features/notifications/HomePromptHost.tsx`,
  'utf8',
);
const settings = fs.readFileSync(`${__dirname}/../settings.tsx`, 'utf8');

describe('G18 notification eligibility contract', () => {
  it('mounts the single Home host without a Classic gamesPlayed gate', () => {
    const host = home.slice(home.indexOf('<HomePromptHost'), home.indexOf('<HomePromptHost') + 300);
    expect(host).toContain('ftueComplete={ftueComplete}');
    expect(host).not.toContain('gamesPlayed');
    expect(home).not.toContain('{gamesPlayed >= 2 ? (');
  });

  it('separates soft acceptance, OS result, and explicit settings re-enable', () => {
    expect(prompt).toContain("'notification_soft_ask_eligible'");
    expect(prompt).toContain("'notification_soft_ask_shown'");
    expect(prompt).toContain("'notification_soft_ask_result'");
    expect(prompt).toContain("requestNotificationPermissions('soft_ask')");
    expect(settings).toContain("requestNotificationPermissions('settings')");
    expect(settings).toContain('Linking.openSettings()');
  });
});
