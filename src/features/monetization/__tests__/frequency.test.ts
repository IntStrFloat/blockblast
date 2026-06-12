import {
  EMPTY_ADS_META,
  recordGameOver,
  recordInterstitialShown,
  shouldShowInterstitial,
} from '../frequency';

const CFG = { minGamesBeforeFirst: 3, minIntervalSec: 120, everyNGameovers: 2 };
const NOW = 1_000_000_000;

function opts(over: Partial<Parameters<typeof shouldShowInterstitial>[1]> = {}) {
  return { enabled: true, removeAds: false, nowMs: NOW, cfg: CFG, ...over };
}

describe('shouldShowInterstitial', () => {
  it('выключено или куплен remove_ads → никогда', () => {
    const meta = { gamesPlayed: 10, gameOversSinceAd: 5, lastInterstitialAt: null };
    expect(shouldShowInterstitial(meta, opts({ enabled: false }))).toBe(false);
    expect(shouldShowInterstitial(meta, opts({ removeAds: true }))).toBe(false);
  });

  it('первые партии без рекламы', () => {
    const meta = { gamesPlayed: 2, gameOversSinceAd: 2, lastInterstitialAt: null };
    expect(shouldShowInterstitial(meta, opts())).toBe(false);
    expect(shouldShowInterstitial({ ...meta, gamesPlayed: 3 }, opts())).toBe(true);
  });

  it('каждый второй game over', () => {
    const meta = { gamesPlayed: 5, gameOversSinceAd: 1, lastInterstitialAt: null };
    expect(shouldShowInterstitial(meta, opts())).toBe(false);
    expect(shouldShowInterstitial({ ...meta, gameOversSinceAd: 2 }, opts())).toBe(true);
  });

  it('интервал между показами', () => {
    const meta = { gamesPlayed: 5, gameOversSinceAd: 3, lastInterstitialAt: NOW - 60_000 };
    expect(shouldShowInterstitial(meta, opts())).toBe(false);
    const longAgo = { ...meta, lastInterstitialAt: NOW - 121_000 };
    expect(shouldShowInterstitial(longAgo, opts())).toBe(true);
  });
});

describe('счётчики', () => {
  it('recordGameOver инкрементит', () => {
    const m = recordGameOver(recordGameOver(EMPTY_ADS_META));
    expect(m.gamesPlayed).toBe(2);
    expect(m.gameOversSinceAd).toBe(2);
  });

  it('recordInterstitialShown сбрасывает серию и пишет время', () => {
    const m = recordInterstitialShown(recordGameOver(EMPTY_ADS_META), NOW);
    expect(m.gameOversSinceAd).toBe(0);
    expect(m.lastInterstitialAt).toBe(NOW);
    expect(m.gamesPlayed).toBe(1);
  });
});
