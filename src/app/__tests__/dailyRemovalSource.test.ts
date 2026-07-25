declare const __dirname: string;

const fs = jest.requireActual<{
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
}>('fs');

const read = (path: string) => fs.readFileSync(`${__dirname}/${path}`, 'utf8');

describe('removed Daily product flow', () => {
  it('removes the Daily bonus feature entry point', () => {
    expect(fs.existsSync(`${__dirname}/../../features/dailybonus/index.ts`)).toBe(false);
  });

  it('does not grant or render bonuses from classic and adventure gameplay', () => {
    expect(read('../../features/game/store.ts')).not.toContain('dailybonus');
    expect(read('../game.tsx')).not.toContain('DailyActivationToast');
    expect(read('../adventure-level.tsx')).not.toContain('useDailyBonus');
    expect(read('../../features/adventure/components/LevelResultView.tsx')).not.toContain(
      'DailyBonusMoment',
    );
  });

  it('does not advertise the removed bonus during onboarding', () => {
    expect(read('../../features/onboarding/components/OnboardingOverlay.tsx')).not.toContain(
      "case 'daily'",
    );
  });
});
