async (page) => {
  if (!page.url().includes('/adventure-level')) throw new Error('Open Adventure first');
  await page.evaluate(() => {
    const modules = Array.from(__r.getModules().entries());
    const load = name => __r(modules.find(([, m]) => m.verboseName === name)[0]);
    const engine = load('src/core/engine/index.ts');
    const store = load('src/features/game/store.ts').useGameStore;
    const originalRun = store.getState().adventure;
    if (!originalRun) throw new Error('Adventure not initialized');
    window.adventureMotionQA = {
      prepare() {
        const game = engine.createGame(4311);
        game.board.fill(0);
        game.board[0] = 1;
        for (let i = 0; i < 8; i++) if (i !== 3) game.board[3 * 8 + i] = 1;
        game.tray = [null, null, { shape: engine.SHAPES_BY_ID.get('dot'), colorId: 1 }];
        const adventure = { ...originalRun, game, status: 'playing', jewelsOnBoard: [], jewelsInTray: [], collectedJewels: 0 };
        store.setState({ game, adventure, lastEvent: null, lastAdventureEvent: null });
      },
      clear() {
        const current = store.getState();
        const result = engine.place(current.game, 2, 3, 3, engine.ADVENTURE_GAME_CONFIG);
        store.setState({ game: result.state, adventure: { ...current.adventure, game: result.state }, lastEvent: result.event });
        return result.event;
      }
    };
  });
  for (const t of [0, 80, 180, 280, 420, 650]) {
    await page.evaluate(() => adventureMotionQA.prepare());
    await page.waitForTimeout(900);
    await page.evaluate(() => adventureMotionQA.clear());
    if (t) await page.waitForTimeout(t);
    await page.screenshot({ path: `output/playwright/adventure-shatter-${t}.png` });
  }
  return { route: page.url(), stages: [0, 80, 180, 280, 420, 650] };
}
