async (page) => {
  const afterNext = await page.evaluate(() => ({
    level: completionQA.store.getState().adventure.level.id,
    status: completionQA.store.getState().adventure.status,
    states: completionQA.states
  }));
  if (afterNext.level !== 's1-l3' || afterNext.status !== 'playing') throw new Error('Next did not advance once');
  await page.evaluate(() => {
    const modules = Array.from(__r.getModules().entries());
    const [id] = modules.find(([,m]) => m.verboseName === 'src/features/adventure/logic/levels.ts');
    const levelFor = __r(id).levelFor;
    const jewelIndex = Array.from({ length: 30 }, (_,i) => i).find(i => levelFor(1, i).objective.type === 'jewels');
    completionQA.progress.setState({ seasonId: 1, levelIndex: jewelIndex });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Настройки', exact: true }).waitFor();
  return afterNext;
}
