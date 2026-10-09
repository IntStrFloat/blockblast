async (page) => {
  const results = [];
  for (const [name, combo, cross] of [['single', 1, false], ['cross-combo5', 5, true], ['cross-combo10', 10, true]]) {
    await page.evaluate(({ combo, cross }) => comboMotionQA.prepare(combo, cross), { combo, cross });
    await page.waitForTimeout(900);
    await page.evaluate(() => comboMotionQA.start());
    for (const t of [100, 300, 850]) {
      const elapsed = await page.evaluate(() => performance.now() - comboMotionQA.startMs);
      if (elapsed < t) await page.waitForTimeout(t - elapsed);
      await page.screenshot({ path: `output/playwright/combo-motion/${name}-${t}.png` });
    }
    await page.waitForTimeout(450);
    const summary = await page.evaluate(() => ({ firstOpacity: comboMotionQA.samples[0].opacity, peak: Math.max(...comboMotionQA.samples.map(s => s.opacity)), lastOpacity: comboMotionQA.samples.at(-1).opacity, visibleRuns: comboMotionQA.samples.reduce((s, x) => { const v = x.opacity > 0.02; if (v && !s.visible) s.runs++; s.visible = v; return s; }, { runs: 0, visible: false }).runs }));
    if (summary.firstOpacity !== 0 || summary.peak < 0.9 || summary.lastOpacity !== 0 || summary.visibleRuns !== 1) throw new Error(`${name}: ${JSON.stringify(summary)}`);
    results.push({ name, ...summary });
  }
  return results;
}
