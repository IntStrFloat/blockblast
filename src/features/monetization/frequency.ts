import { MONETIZATION } from './config';

export interface AdsMeta {
  gamesPlayed: number;
  gameOversSinceAd: number;
  /** unix ms последнего interstitial */
  lastInterstitialAt: number | null;
}

export const EMPTY_ADS_META: AdsMeta = {
  gamesPlayed: 0,
  gameOversSinceAd: 0,
  lastInterstitialAt: null,
};

export interface InterstitialCfg {
  minGamesBeforeFirst: number;
  minIntervalSec: number;
  everyNGameovers: number;
}

interface FrequencyOpts {
  enabled: boolean;
  removeAds: boolean;
  nowMs: number;
  cfg?: InterstitialCfg;
}

/** Частотные правила interstitial после Game Over (спека 05). */
export function shouldShowInterstitial(meta: AdsMeta, opts: FrequencyOpts): boolean {
  const cfg = opts.cfg ?? MONETIZATION.interstitial;
  if (!opts.enabled || opts.removeAds) return false;
  if (meta.gamesPlayed < cfg.minGamesBeforeFirst) return false;
  if (meta.gameOversSinceAd < cfg.everyNGameovers) return false;
  if (
    meta.lastInterstitialAt !== null &&
    opts.nowMs - meta.lastInterstitialAt < cfg.minIntervalSec * 1000
  ) {
    return false;
  }
  return true;
}

export function recordGameOver(meta: AdsMeta): AdsMeta {
  return {
    ...meta,
    gamesPlayed: meta.gamesPlayed + 1,
    gameOversSinceAd: meta.gameOversSinceAd + 1,
  };
}

export function recordInterstitialShown(meta: AdsMeta, nowMs: number): AdsMeta {
  return { ...meta, gameOversSinceAd: 0, lastInterstitialAt: nowMs };
}
