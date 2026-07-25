import { MONETIZATION } from './config';

export interface AdsMeta {
  gamesPlayed: number;
  gameOversSinceAd: number;
  adventureFailsSinceAd: number;
  adventureLevelsSinceAd: number;
  /** Unix ms of the last interstitial show. */
  lastInterstitialAt: number | null;
}

export const EMPTY_ADS_META: AdsMeta = {
  gamesPlayed: 0,
  gameOversSinceAd: 0,
  adventureFailsSinceAd: 0,
  adventureLevelsSinceAd: 0,
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

export type InterstitialCounter = 'gameover' | 'adventure_fail' | 'adventure_level';

function counterValue(meta: AdsMeta, counter: InterstitialCounter): number {
  if (counter === 'adventure_fail') return meta.adventureFailsSinceAd ?? 0;
  if (counter === 'adventure_level') return meta.adventureLevelsSinceAd ?? 0;
  return meta.gameOversSinceAd;
}

export function shouldShowInterstitial(
  meta: AdsMeta,
  opts: FrequencyOpts,
  counter: InterstitialCounter = 'gameover',
): boolean {
  const cfg = opts.cfg ?? MONETIZATION.interstitial;
  const count = counterValue(meta, counter);
  if (!opts.enabled || opts.removeAds) return false;
  // Отсрочка первой межстранички (только для классического game over): гейт по
  // общему числу партий, чтобы новичок не увидел рекламу в первой сессии. Каденс
  // после этого — независимо, по everyNGameovers (см. ниже).
  if (counter === 'gameover' && meta.gamesPlayed < cfg.minGamesBeforeFirst) return false;
  if (count < cfg.everyNGameovers) return false;
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
    adventureFailsSinceAd: meta.adventureFailsSinceAd ?? 0,
    adventureLevelsSinceAd: meta.adventureLevelsSinceAd ?? 0,
  };
}

export function recordAdventureFail(meta: AdsMeta): AdsMeta {
  return {
    ...meta,
    adventureFailsSinceAd: (meta.adventureFailsSinceAd ?? 0) + 1,
    adventureLevelsSinceAd: meta.adventureLevelsSinceAd ?? 0,
  };
}

export function recordAdventureLevelWin(meta: AdsMeta): AdsMeta {
  return {
    ...meta,
    adventureFailsSinceAd: meta.adventureFailsSinceAd ?? 0,
    adventureLevelsSinceAd: (meta.adventureLevelsSinceAd ?? 0) + 1,
  };
}

export function recordInterstitialShown(
  meta: AdsMeta,
  nowMs: number,
  counter: InterstitialCounter = 'gameover',
): AdsMeta {
  const next = {
    ...meta,
    adventureFailsSinceAd: meta.adventureFailsSinceAd ?? 0,
    adventureLevelsSinceAd: meta.adventureLevelsSinceAd ?? 0,
    lastInterstitialAt: nowMs,
  };
  if (counter === 'adventure_fail') return { ...next, adventureFailsSinceAd: 0 };
  if (counter === 'adventure_level') return { ...next, adventureLevelsSinceAd: 0 };
  return { ...next, gameOversSinceAd: 0 };
}
