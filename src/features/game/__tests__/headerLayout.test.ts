import { getClassicHudMetrics, getClassicPlayfieldMetrics, hudNumberFontSize, PLAYFIELD_LAYOUT } from '../playfield-layout';
import { GAME_FEEL_MOTION } from '../animation/motion';

describe('Classic header and utility bounds', () => {
  it('keeps six-digit scores readable instead of collapsing under a large system font', () => {
    const hud = getClassicHudMetrics(320, true);
    expect(hudNumberFontSize(123456, hud.scoreWidth, hud.fontSize)).toBeGreaterThanOrEqual(18);
    expect(hudNumberFontSize(987654, hud.sideWidth, 14)).toBeGreaterThanOrEqual(12);
    expect(hudNumberFontSize(123456, hud.scoreWidth, hud.fontSize) * 6).toBeLessThanOrEqual(hud.scoreWidth);
  });
  it.each([320, 360, 393, 412])('keeps both score pulse and record/status inside the available %s dp row', (width) => {
    for (const compact of [true, false]) {
      const hud = getClassicHudMetrics(width, compact);
      expect(hud.sideWidth * 2 + hud.centerWidth + hud.gap * 2 + hud.padding * 2).toBeLessThanOrEqual(width);
      expect(hud.scoreWidth * GAME_FEEL_MOTION.scoreScaleMax).toBeLessThanOrEqual(hud.centerWidth);
      expect(hud.scoreHeight * GAME_FEEL_MOTION.scoreScaleMax + hud.statusHeight).toBeLessThanOrEqual(hud.height);
      expect(hud.statusWidth * 1.12).toBeLessThanOrEqual(hud.centerWidth);
      expect(hud.sideWidth).toBeGreaterThanOrEqual(48);
    }
  });

  it.each([[320, 568], [360, 640], [375, 667], [393, 852], [412, 915]])('fits actual non-overlapping sections at %s×%s with and without the banner', (width, height) => {
    for (const banner of [false, true]) {
      const metrics = getClassicPlayfieldMetrics(width, height, { top: 24, bottom: 24 }, 6, banner);
      const content = PLAYFIELD_LAYOUT.contentTopPadding + metrics.hudHeight + metrics.mascotHeight + metrics.boardSize + metrics.trayHeight + 18 + (banner ? PLAYFIELD_LAYOUT.adReserve : 0);
      expect(content).toBeLessThanOrEqual(height - 48);
      expect(metrics.mascotHeight).toBeGreaterThanOrEqual(48);
      expect(metrics.boardSize).toBeGreaterThanOrEqual(170);
      expect(metrics.trayHeight).toBeGreaterThanOrEqual(80);
    }
  });
});
