async (page) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(300);
  await page.evaluate(() => comboMotionQA.prepare(10, true));
  await page.waitForTimeout(900);
  await page.evaluate(() => comboMotionQA.start());
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-testid="clear-praise"]')).opacity) > 0.95);
  await page.screenshot({ path: 'output/playwright/combo-motion/classic-combo10-peak.png' });
  return await page.evaluate(() => ({ label: document.querySelector('[data-testid="clear-praise"]').textContent, particles: document.querySelectorAll('[data-testid^="combo-particle-"]').length, sweep: getComputedStyle(document.querySelector('[data-testid="clear-praise"]')).transform }));
}
