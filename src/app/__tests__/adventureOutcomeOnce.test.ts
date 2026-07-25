declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const levelSource = fs.readFileSync(`${__dirname}/../adventure-level.tsx`, 'utf8');

/**
 * Регрессия «recordWin дважды на победу» (2 победы → консекутив 4, цель дня 4/5,
 * скип уровней): recordWin двигает levelIndex → spec пересчитывается → стартовый
 * эффект в том же коммите сбрасывает handledOutcome и пересоздаёт ран следующего
 * уровня, а outcome-эффект ветвился по УСТАРЕВШЕМУ render-захваченному runStatus
 * ('won') при уже совпавшем уровне свежего рана. Контракт: исход читается свежим
 * из стора (state.status), 'playing' выходит раньше любых записей.
 */
describe('adventure outcome is recorded exactly once per win', () => {
  it('branches on fresh state.status, never on render-captured runStatus', () => {
    expect(levelSource).not.toContain("runStatus === 'won'");
    expect(levelSource).toContain("state.status === 'won'");
  });

  it('bails out early when the fresh run is already playing (restarted next level)', () => {
    const outcomeStart = levelSource.indexOf('handledOutcome.current) return;');
    const recordWinAt = levelSource.indexOf('recordWin(todayISO())');
    const freshPlayingGuard = levelSource.indexOf("state.status === 'playing'");
    expect(outcomeStart).toBeGreaterThan(-1);
    expect(freshPlayingGuard).toBeGreaterThan(outcomeStart);
    expect(freshPlayingGuard).toBeLessThan(recordWinAt);
  });
});
