async (page) => {
  const before = await page.evaluate(() => {
    const [id] = Array.from(__r.getModules().entries()).find(([, m]) => m.verboseName === 'src/features/adventure/store.ts');
    const store = __r(id).useAdventure;
    store.setState({ seasonId: 1, levelIndex: 7, consecutive: 3 });
    store.getState().applySeasonWindow({ seasonId: 2, serverNowIso: '2026-09-05T12:00:00.000Z', windowStartIso: '2026-09-01T00:00:00.000Z', windowEndIso: '2026-09-15T00:00:00.000Z', durationDays: 14 });
    return { seasonId: store.getState().seasonId, levelIndex: store.getState().levelIndex };
  });
  await page.goto('http://localhost:8081/adventure');
  await page.getByText('Приключение', { exact: true }).first().waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'output/playwright/adventure-window-2.png' });
  const after = await page.evaluate(() => {
    const [id] = Array.from(__r.getModules().entries()).find(([, m]) => m.verboseName === 'src/features/adventure/store.ts');
    const store = __r(id).useAdventure;
    store.getState().applySeasonWindow({ ...store.getState().seasonWindow, seasonId: 3 });
    return { seasonId: store.getState().seasonId, levelIndex: store.getState().levelIndex, consecutive: store.getState().consecutive };
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'output/playwright/adventure-window-3.png' });
  return { before, after, text: await page.locator('body').innerText() };
}
