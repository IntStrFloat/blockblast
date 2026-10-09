async (page) => {
  await page.evaluate(() => {
    const modules = Array.from(__r.getModules().entries());
    const [id] = modules.find(([,m]) => m.verboseName === 'src/features/adventure/store.ts');
    const progress = __r(id).useAdventure;
    for (let i = 0; i < 8 && progress.getState().levelIndex < 7; i++) progress.getState().recordWin('2026-09-05');
  });
  await page.reload();
  await page.getByRole('button', { name: 'Настройки', exact: true }).waitFor();
}
