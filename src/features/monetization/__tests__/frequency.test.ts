import {
  EMPTY_ADS_META,
  recordGameOver,
  recordInterstitialShown,
  shouldShowInterstitial,
} from '../frequency';
import { MONETIZATION } from '../config';

const CFG = { minGamesBeforeFirst: 3, minIntervalSec: 0, everyNGameovers: 3 };
const NOW = 1_000_000_000;

function opts(over: Partial<Parameters<typeof shouldShowInterstitial>[1]> = {}) {
  return { enabled: true, removeAds: false, nowMs: NOW, cfg: CFG, ...over };
}

describe('shouldShowInterstitial', () => {
  it('production config schedules interstitial every third loss', () => {
    expect(MONETIZATION.interstitial).toEqual(CFG);
  });

  it('выключено или куплен remove_ads → никогда', () => {
    const meta = { gamesPlayed: 10, gameOversSinceAd: 5, lastInterstitialAt: null };
    expect(shouldShowInterstitial(meta, opts({ enabled: false }))).toBe(false);
    expect(shouldShowInterstitial(meta, opts({ removeAds: true }))).toBe(false);
  });

  it('показывает первую рекламу ровно после третьего проигрыша', () => {
    const meta = { gamesPlayed: 2, gameOversSinceAd: 2, lastInterstitialAt: null };
    expect(shouldShowInterstitial(meta, opts())).toBe(false);
    expect(
      shouldShowInterstitial({ ...meta, gamesPlayed: 3, gameOversSinceAd: 3 }, opts()),
    ).toBe(true);
  });

  it('показывает следующую рекламу после ещё трёх проигрышей', () => {
    const meta = { gamesPlayed: 5, gameOversSinceAd: 2, lastInterstitialAt: NOW - 1 };
    expect(shouldShowInterstitial(meta, opts())).toBe(false);
    expect(
      shouldShowInterstitial({ ...meta, gamesPlayed: 6, gameOversSinceAd: 3 }, opts()),
    ).toBe(true);
  });

  it('соблюдает интервал, когда он включён конфигурацией', () => {
    const intervalCfg = { ...CFG, minIntervalSec: 120 };
    const meta = { gamesPlayed: 5, gameOversSinceAd: 3, lastInterstitialAt: NOW - 60_000 };
    expect(shouldShowInterstitial(meta, opts({ cfg: intervalCfg }))).toBe(false);
    const longAgo = { ...meta, lastInterstitialAt: NOW - 121_000 };
    expect(shouldShowInterstitial(longAgo, opts({ cfg: intervalCfg }))).toBe(true);
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
