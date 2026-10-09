async (page) => {
  await page.evaluate(() => {
    const modules = Array.from(__r.getModules().entries());
    const load = name => __r(modules.find(([, m]) => m.verboseName === name)[0]);
    const engine = load('src/core/engine/index.ts');
    const store = load('src/features/game/store.ts').useGameStore;
    load('src/features/scores/store.ts').useScores.setState({ best: 1000000 });
    window.comboMotionQA = {
      prepare(combo = 5, cross = false) {
        const game = engine.createGame(4311); game.board.fill(0); game.board[0] = 1;
        for (let i = 0; i < 8; i++) { if (i !== 3) { game.board[24 + i] = 2; if (cross) game.board[i * 8 + 3] = 2; } }
        game.combo = combo - 1; game.score = 500; game.dryMoves = 0;
        game.tray = [null, null, { shape: engine.SHAPES_BY_ID.get('dot'), colorId: 2 }];
        store.setState({ game, adventure: null, lastEvent: null, lastAdventureEvent: null, runBestAtStart: 1000000, recordCelebration: null, recordCelebrated: false });
      },
      start() {
        this.samples = []; this.startMs = performance.now();
        store.getState().placePiece(2, 3, 3);
        const tick = () => {
          const elapsed = performance.now() - this.startMs;
          const element = document.querySelector('[data-testid="clear-praise"]');
          let opacity = 1, node = element;
          while (node) { opacity *= Number(getComputedStyle(node).opacity); node = node.parentElement; }
          this.samples.push({ t: Math.round(elapsed), opacity: element ? Number(opacity.toFixed(4)) : 0 });
          if (elapsed < 1200) requestAnimationFrame(tick);
        }; requestAnimationFrame(tick);
      }
    };
    comboMotionQA.prepare();
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'output/playwright/combo-motion/fixed-board.png' });
  await page.evaluate(() => comboMotionQA.start());
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'output/playwright/combo-motion/fixed-combo.png' });
  await page.waitForTimeout(950);
  return await page.evaluate(() => ({ frames: comboMotionQA.samples.length, first: comboMotionQA.samples.slice(0, 4), visibleRuns: comboMotionQA.samples.reduce((s, x) => { const v = x.opacity > 0.02; if (v && !s.visible) s.runs++; s.visible = v; return s; }, { runs: 0, visible: false }), last: comboMotionQA.samples.slice(-4) }));
}

