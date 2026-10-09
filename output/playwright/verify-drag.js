async (page) => {
  await page.evaluate(() => motionQA.prepare('row', 0));
  await page.waitForTimeout(1000);
  const tray = page.getByTestId('tray-hit-2');
  const rect = await tray.boundingBox();
  const x = rect.x + rect.width / 2;
  const y = rect.y + (rect.height - 24) / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(50, 700, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(550);
  const cancelled = await page.evaluate(() => {
    const [id] = Array.from(__r.getModules().entries()).find(([, m]) => m.verboseName === 'src/features/game/store.ts');
    const s = __r(id).useGameStore.getState();
    return { score: s.game.score, hasPiece: !!s.game.tray[2], event: s.lastEvent };
  });
  await page.screenshot({ path: 'output/playwright/drag-return.png' });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(173, 340, { steps: 20 });
  await page.waitForTimeout(140);
  await page.screenshot({ path: 'output/playwright/drag-preview.png' });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  const accepted = await page.evaluate(() => {
    const [id] = Array.from(__r.getModules().entries()).find(([, m]) => m.verboseName === 'src/features/game/store.ts');
    const s = __r(id).useGameStore.getState();
    return { score: s.game.score, rows: s.lastEvent?.clearedRows, trayCount: s.game.tray.filter(Boolean).length };
  });
  await page.screenshot({ path: 'output/playwright/drag-accepted.png' });
  if (cancelled.score !== 1200 || !cancelled.hasPiece || cancelled.event !== null) throw new Error('Cancelled drag changed game');
  if (!accepted.rows?.includes(3) || accepted.trayCount !== 3) throw new Error('Valid drop or refill failed');
  return { cancelled, accepted };
}
