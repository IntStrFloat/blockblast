async (page) => {
  await page.goto('http://localhost:8082/adventure-level');
  await page.getByRole('button', { name: 'Настройки', exact: true }).waitFor();
  await page.evaluate(() => {
    const modules = Array.from(__r.getModules().entries());
    const load = name => __r(modules.find(([, m]) => m.verboseName === name)[0]);
    const engine = load('src/core/engine/index.ts');
    const store = load('src/features/game/store.ts').useGameStore;
    const run = store.getState().adventure;
    const game = engine.createGame(4311); game.board.fill(0); game.board[0] = 1;
    for (let i = 0; i < 8; i++) if (i !== 3) { game.board[24 + i] = 1; game.board[i * 8 + 3] = 1; }
    game.combo = 4; game.score = run.level.objective.target - 1;
    game.tray = [null, null, { shape: engine.SHAPES_BY_ID.get('dot'), colorId: 1 }];
    store.setState({ game, adventure: { ...run, game, status: 'playing', jewelsOnBoard: [24], jewelsInTray: [], collectedJewels: run.level.objective.target - 1 }, lastEvent: null, lastAdventureEvent: null });
    window.adventureComboQA = { store, level: run.level.id, samples: [] };
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const qa = adventureComboQA; qa.start = performance.now();
    qa.store.getState().placePiece(2, 3, 3);
    const tick = () => {
      const t = performance.now() - qa.start;
      const el = Array.from(document.querySelectorAll('[data-testid="clear-praise"]')).at(-1);
      let opacity = 1, n = el;
      while(n) { opacity *= Number(getComputedStyle(n).opacity); n = n.parentElement; }
      qa.samples.push({ t: Math.round(t), opacity: el ? opacity : 0 });
      if (t < 1450) requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  });
  for (const t of [120, 360, 800, 1400]) {
    const elapsed = await page.evaluate(() => performance.now() - adventureComboQA.start);
    if (elapsed < t) await page.waitForTimeout(t - elapsed);
    await page.screenshot({ path: `output/playwright/combo-motion/adventure-win-${t}.png` });
  }
  const result = await page.evaluate(() => ({ level: adventureComboQA.store.getState().adventure.level.id, expectedLevel: adventureComboQA.level, status: adventureComboQA.store.getState().adventure.status, firstOpacity: adventureComboQA.samples[0].opacity, lastOpacity: adventureComboQA.samples.at(-1).opacity, runs: adventureComboQA.samples.reduce((s,x) => { const v = x.opacity > .02; if(v&&!s.v) s.runs++; s.v = v; return s; },{v:false,runs:0}).runs, resultCount: [...document.querySelectorAll('[role="heading"]')].filter(el => el.textContent.includes('Уровень пройден')).length }));
  if (result.status !== 'won' || result.level !== result.expectedLevel || result.firstOpacity !== 0 || result.lastOpacity !== 0 || result.runs !== 1 || result.resultCount !== 1) throw new Error(JSON.stringify(result));
  return result;
}
