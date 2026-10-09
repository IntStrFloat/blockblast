declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');

function read(path: string): string {
  return fs.readFileSync(`${__dirname}/${path}`, 'utf8');
}

describe('G07 weekly goal UI contract', () => {
  it('shows one immutable visual goal and keeps remainder/completion accessible', () => {
    const leaderboard = read('../leaderboard.tsx');
    expect(leaderboard).toContain('Math.max(weeklyBest, assignedGoal.progress)');
    expect(leaderboard).toContain('`${goal.current}/${goal.target}');
    expect(leaderboard).toContain('goal.remaining');
    expect(leaderboard).toContain('accessibilityRole="progressbar"');
    expect(leaderboard).toContain('${goalStateLabel}');
    expect(leaderboard).not.toContain('styles.goalText');
    expect(leaderboard).toContain("'Следующая цель · Играть'");
    expect(leaderboard).toContain("'Играть'");
  });

  it('attributes leaderboard and Home replay before the explicit next-stage transition', () => {
    const leaderboard = read('../leaderboard.tsx');
    const home = read('../index.tsx');
    expect(leaderboard.indexOf("recordNextGoalClick('weekly', assignedGoal.goalId)"))
      .toBeLessThan(leaderboard.indexOf('advanceCompleted(new Date(), goal.current)'));
    expect(home).toContain('recordNextGoalClick(nextAction.kind, nextAction.goalId)');
    expect(home).toContain('advanceCompleted(new Date(), weeklyGoal.current)');
  });
});
