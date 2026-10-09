async (page) => {
  await page.getByRole('button', { name: 'Настройки', exact: true }).waitFor();
  await page.evaluate(() => {
    const modules = Array.from(__r.getModules().entries());
    const load = name => __r(modules.find(([, m]) => m.verboseName === name)[0]);
    const engine = load('src/core/engine/index.ts');
    const store = load('src/features/game/store.ts').useGameStore;
    const progress = load('src/features/adventure/store.ts').useAdventure;
    const run = store.getState().adventure;
    const game = engine.createGame(4311);
    game.board.fill(0); game.board[0] = 1;
    for (let i = 0; i < 8; i++) if (i !== 3) game.board[24 + i] = 1;
    game.score = run.level.objective.target - 1;
    game.tray = [null, null, { shape: engine.SHAPES_BY_ID.get('dot'), colorId: 1 }];
    store.setState({ game, adventure: { ...run, game, status: 'playing', jewelsOnBoard: [], jewelsInTray: [] }, lastEvent: null, lastAdventureEvent: null });
    window.completionQA = { store, progress, states: [] };
    store.subscribe(s => completionQA.states.push({ epoch: s.epoch, run: s.adventure?.level.id, status: s.adventure?.status, clear: s.lastEvent?.clearedCells.length }));
  });
  await page.screenshot({ path: 'output/playwright/completion-before.png' });
  const clear = await page.evaluate(() => {
    completionQA.started = performance.now();
    const event = completionQA.store.getState().placePiece(2, 3, 3);
    return { cleared: event?.clearedCells.length, status: completionQA.store.getState().adventure.status };
  });
  const frames = [];
  for (const time of [120, 420, 800, 1250]) {
    const elapsed = await page.evaluate(() => performance.now() - completionQA.started);
    if (elapsed < time) await page.waitForTimeout(time - elapsed);
    await page.screenshot({ path: `output/playwright/completion-${time}.png` });
    frames.push(await page.evaluate(() => ({ elapsed: Math.round(performance.now() - completionQA.started), text: document.body.innerText, run: completionQA.store.getState().adventure.level.id, epoch: completionQA.store.getState().epoch })));
  }
  return { clear, frames, states: await page.evaluate(() => completionQA.states) };
}

