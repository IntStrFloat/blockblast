declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const source = fs.readFileSync(`${__dirname}/../leaderboard.tsx`, 'utf8');

describe('G08 weekly prize UI contract', () => {
  it('has distinct finalization, offline, eligible, pending, and ineligible states', () => {
    expect(source).toContain('Подводим итог прошлой недели…');
    expect(source).toContain('Нет сети — проверим итог позже');
    expect(source).toContain('Не удалось проверить или получить награду');
    expect(source).toContain('claimingRewardId === pendingPrize.rewardId');
    expect(source).toContain('Итог недели: #${latestOutcome.rank} · без приза');
    expect(source).toContain('missedPrizeCount');
  });

  it('delegates claim and local effects to the async store settlement', () => {
    expect(source).toContain('claimWeeklyPrize(pendingPrize.rewardId)');
    expect(source).not.toContain('useProgression.getState().addPoints');
    expect(source).not.toContain('useMascot.getState().unlock');
  });
});
