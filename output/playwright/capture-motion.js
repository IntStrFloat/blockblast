async (page) => {
  if (!page.url().includes('/game?')) throw new Error('Open Classic from the home screen before capture');
  // Exercise the actual screen with deterministic local state, without a test route in the app.
  await page.evaluate(() => {
    const modules = Array.from(__r.getModules().entries());
    const moduleFor = (name) => __r(modules.find(([, m]) => m.verboseName === name)[0]);
    const engine = moduleFor('src/core/engine/index.ts');
    const store = moduleFor('src/features/game/store.ts').useGameStore;
    window.motionQA = {
      prepare(kind = 'cross', combo = 2) {
        const game = engine.createGame(4311);
        game.board.fill(0);
        game.board[0] = 3;
        for (let i = 0; i < 8; i++) {
          if (i !== 3) game.board[3 * 8 + i] = 2;
          if (kind === 'cross' && i !== 3) game.board[i * 8 + 3] = 2;
        }
        game.tray = [null, null, { shape: engine.SHAPES_BY_ID.get('dot'), colorId: 2 }];
        game.score = 1200;
        game.combo = combo;
        store.setState({ game, lastEvent: null, adventure: null, lastAdventureEvent: null, recordCelebration: null, finalResult: null, runBestAtStart: 999999, epoch: store.getState().epoch + 1 });
      },
      clear() {
        const result = engine.place(store.getState().game, 2, 3, 3);
        store.setState({ game: result.state, lastEvent: result.event });
        return result.event;
      }
    };
  });
  const samples = [];
  for (const t of [0, 60, 130, 230, 370, 600, 900]) {
    await page.evaluate(() => motionQA.prepare());
    await page.waitForTimeout(1000);
    await page.evaluate(() => motionQA.clear());
    if (t) await page.waitForTimeout(t);
    await page.screenshot({ path: `output/playwright/motion-${t}.png` });
    samples.push(t);
  }
  await page.evaluate(() => motionQA.prepare('row', 0));
  await page.waitForTimeout(1000);
  return { samples, viewport: page.viewportSize() };
}
