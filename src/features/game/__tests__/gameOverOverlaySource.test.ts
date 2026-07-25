declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('game-over overlay source contract', () => {
  const source = fs.readFileSync(`${__dirname}/../components/GameOverOverlay.tsx`, 'utf8');

  it('shows the run result: final score plus record/best comparison', () => {
    expect(source).toContain("t('gameOver.title', lang)");
    expect(source).toContain("t('gameOver.newRecord', lang)");
    expect(source).toContain("t('gameOver.firstResult', lang)");
    expect(source).toContain("t('gameOver.score', lang)");
    expect(source).toContain("t('gameOver.best', lang)");
    expect(source).toContain('<AnimatedFinalScore score={game.score} />');
    expect(source).toContain('game.score > 0 && game.score === best');
    expect(source).toContain('best_at_start: runBestAtStart');
  });

  it('counts the final score from zero when the result screen is shown', () => {
    expect(source).toContain('function AnimatedFinalScore');
    expect(source).toContain('const [displayedScore, setDisplayedScore] = useState(0);');
    expect(source).toContain('const progress = useSharedValue(0);');
    expect(source).toContain('SCORE_COUNT_UP_DURATION');
    expect(source).toContain('withTiming(1, {');
    expect(source).toContain('Math.round(progress.value * score)');
  });

  it('uses a full-screen gradient result surface with a distinct record treatment', () => {
    expect(source).toContain('LinearGradient');
    expect(source).toContain('newRecord ? RECORD_GRADIENT : GAME_OVER_GRADIENT');
    expect(source).toContain('<CrownIcon');
    expect(source).toContain('<GearIcon');
    expect(source).not.toContain('<Overlay>');
  });

  it('offers a prominent replay without a direct Home action', () => {
    expect(source).toContain("t('gameOver.playAgain', lang)");
    expect(source).toContain("onPress={() => closeWithInterstitial('replay', onPlayAgain)}");
    expect(source).toContain('onOpenSettings');
    expect(source).not.toContain('onHome');
    expect(source).not.toContain("t('gameOver.home', lang)");
  });

  it('shows rewarded revive only when it is actually available', () => {
    expect(source).toContain('<ReviveButton');
    expect(source).toContain("t('gameOver.revive', lang)");
    expect(source).toContain('const canOfferRevive = !game.reviveUsed;');
    expect(source).toContain('getRewardedCtaPolicy');
    expect(source).toContain('{revivePolicy.visible ? (');
    expect(source).toContain('disabled={revivePolicy.disabled}');
  });

  it('stays a pure result screen — no leaderboard/share plumbing', () => {
    expect(source).not.toContain('useLeaderboardStore');
    expect(source).not.toContain('shareScore');
    expect(source).not.toContain('DailyBonusMoment');
  });
});
