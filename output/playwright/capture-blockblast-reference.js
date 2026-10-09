async (page) => {
  const video = page.locator('video');
  await video.evaluate(v => { v.pause(); document.body.appendChild(v); v.style.cssText = 'position:fixed;left:0;top:0;width:326px;height:706px;z-index:99999;object-fit:contain;background:#000'; });
  for (const t of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]) {
    await video.evaluate((v, time) => new Promise(resolve => { v.addEventListener('seeked', resolve, { once: true }); v.currentTime = time + 0.01; }), t);
    await video.screenshot({ path: `output/playwright/reference-${t}.png` });
  }
  return { source: page.url(), duration: await video.evaluate(v => v.duration) };
}
