declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

describe('game-over overlay source contract', () => {
  const source = fs.readFileSync(`${__dirname}/../components/GameOverOverlay.tsx`, 'utf8');

  it('asks whether to continue and only offers rewarded continuation or a new game', () => {
    expect(source).toContain("t('gameOver.revivePrompt', lang)");
    expect(source).toContain("t('gameOver.revive', lang)");
    expect(source).toContain("t('gameOver.decline', lang)");
    expect(source).toContain("t('gameOver.title', lang)");
    expect(source).toContain('<ReviveButton');
    expect(source).toContain('const canOfferRevive = !game.reviveUsed;');
    expect(source).toContain('disabled={busy || !rewardedReady}');
    expect(source).toContain('onPress={() => closeWithInterstitial(onPlayAgain)}');
    expect(source).toContain('<Pressable');
    expect(source).toContain("textDecorationLine: 'underline'");

    expect(source).not.toContain('useLeaderboardStore');
    expect(source).not.toContain('shareScore');
    expect(source).not.toContain('onHome');
    expect(source).not.toContain("t('gameOver.newRecord', lang)");
    expect(source).not.toContain("t('gameOver.recordDelta', lang)");
    expect(source).not.toContain("t('gameOver.playAgain', lang)");
    expect(source).not.toContain("t('gameOver.share', lang)");
    expect(source).not.toContain("t('gameOver.home', lang)");
    expect(source).not.toContain("t('gameOver.weeklyImpact', lang)");
    expect(source).not.toContain("t('gameOver.score', lang)");
    expect(source).not.toContain('{game.score}');
  });
});
