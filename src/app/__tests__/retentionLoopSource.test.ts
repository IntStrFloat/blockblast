declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');

describe('retention loop surfaces', () => {
  it('keeps one measurable Home goal and routes collection through /capy', () => {
    const home = fs.readFileSync(`${__dirname}/../index.tsx`, 'utf8');
    const selector = fs.readFileSync(`${__dirname}/../../features/home/nextAction.ts`, 'utf8');
    expect(selector).toContain('remaining: Math.max(0, goal.target - goal.current)');
    expect(home).toContain("router.push('/capy')");
    expect(home).toContain('recordNextGoalClick(nextAction.kind, nextAction.goalId)');
  });

  it('shows a concrete map reward with a direct equip action', () => {
    const map = fs.readFileSync(`${__dirname}/../map.tsx`, 'utf8');
    expect(map).toContain('testID="map-reward-preview"');
    expect(map).toContain("equip(previewCosmetic.slot, previewCosmetic.id, 'map')");
    expect(map).toContain('rewardPreview.remaining');
  });

  it('renders actual XP and queues level-up presentation independently', () => {
    const classic = fs.readFileSync(`${__dirname}/../../features/game/components/GameOverOverlay.tsx`, 'utf8');
    const adventure = fs.readFileSync(`${__dirname}/../../features/adventure/components/LevelResultView.tsx`, 'utf8');
    const progression = fs.readFileSync(`${__dirname}/../../features/progression/store.ts`, 'utf8');
    expect(classic).toContain('<RewardProgressSummary');
    expect(adventure).toContain('<RewardProgressSummary');
    expect(progression).toContain('revealQueue');
    expect(progression).toContain('rewardReceipts');
  });
});
