declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const source = fs.readFileSync(`${__dirname}/../adventure-level.tsx`, 'utf8');

describe('Adventure in-game settings source contract', () => {
  it('keeps only the shared in-game settings control in the header', () => {
    expect(source).toContain("import { PauseOverlay } from '@/features/game/components/PauseOverlay';");
    expect(source).toContain("onPress={() => setPaused(true)}");
    expect(source).not.toContain('<ChevronIcon');
    expect(source).not.toContain("router.push('/settings'");
  });

  it('reuses Classic game controls with Home returning to the main screen and Adventure restart', () => {
    expect(source).toContain('<PauseOverlay');
    expect(source).toContain('const exitToHome');
    expect(source).toContain("router.replace('/' as Href)");
    expect(source).toContain('onHome={exitToHome}');
    expect(source).toContain('onRestart={confirmRestart}');
    expect(source).toContain('<ConfirmDialog');
    expect(source).toContain('onConfirm={restartCurrentLevel}');
  });

  it('skips interstitials on explicit Exit and credits Adventure progress toward banner depth', () => {
    expect(source.match(/onExit=\{exitToHub\}/g)).toHaveLength(2);
    expect(source).not.toContain("onExit={() => void runAfterInterstitial('adventure_level', exitToHub)}");
    expect(source).not.toContain("onExit={() => void runAfterInterstitial('adventure_fail', exitToHub)}");
    expect(source).toContain('const completedAdventureLevels = useMemo(');
    expect(source).toContain('const bannerGamesPlayed = gamesPlayed + completedAdventureLevels;');
    expect(source).toContain('gamesPlayed={bannerGamesPlayed}');
  });
});
