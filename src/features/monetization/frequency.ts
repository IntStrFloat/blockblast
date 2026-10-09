import { MONETIZATION } from './config';

export interface AdsMeta {
  /** A visible voluntary offer protects this result even after a cold reopen. */
  rewardedOfferContextId?: string | null;
  gamesPlayed: number;
  adventureRunsPlayed?: number;
  adventureLevelsCompleted?: number;
  gameOversSinceAd: number;
  adventureFailsSinceAd: number;
  adventureLevelsSinceAd: number;
  /** Unix ms of the last fullscreen ad surface (interstitial or rewarded revive). */
  lastFullscreenAt?: number | null;
  /** Unix ms of the last interstitial show. */
  lastInterstitialAt: number | null;
  /** Product-session scope for the treatment's reversible two-show cap. */
  interstitialSessionId?: string | null;
  interstitialShowsInSession?: number;
}

export const EMPTY_ADS_META: AdsMeta = {
  gamesPlayed: 0,
  adventureRunsPlayed: 0,
  adventureLevelsCompleted: 0,
  gameOversSinceAd: 0,
  adventureFailsSinceAd: 0,
  adventureLevelsSinceAd: 0,
  lastFullscreenAt: null,
  lastInterstitialAt: null,
  interstitialSessionId: null,
  interstitialShowsInSession: 0,
};

export interface InterstitialCfg {
  minGamesBeforeFirst: number;
  minIntervalSec: number;
  everyNGameovers: number;
}

export interface FrequencyOpts {
  enabled: boolean;
  removeAds: boolean;
  nowMs: number;
  cfg?: InterstitialCfg;
}

export type InterstitialCounter = 'gameover' | 'adventure_fail' | 'adventure_level';

export function interstitialShowsForSession(meta: AdsMeta, productSessionId: string): number {
  return meta.interstitialSessionId === productSessionId
    ? Math.max(0, meta.interstitialShowsInSession ?? 0)
    : 0;
}

function counterValue(meta: AdsMeta, counter: InterstitialCounter): number {
  if (counter === 'adventure_fail') return meta.adventureFailsSinceAd ?? 0;
  if (counter === 'adventure_level') return meta.adventureLevelsSinceAd ?? 0;
  return meta.gameOversSinceAd;
}

function totalFinishedRuns(meta: AdsMeta): number {
  const adventureRunsPlayed =
    meta.adventureRunsPlayed ??
    (meta.adventureFailsSinceAd ?? 0) + (meta.adventureLevelsSinceAd ?? 0);
  return meta.gamesPlayed + adventureRunsPlayed;
}

function lastFullscreenAnchor(meta: AdsMeta): number | null {
  const fullscreenAt = meta.lastFullscreenAt ?? null;
  if (fullscreenAt === null) return meta.lastInterstitialAt;
  if (meta.lastInterstitialAt === null) return fullscreenAt;
  return Math.max(fullscreenAt, meta.lastInterstitialAt);
}

export function shouldShowInterstitial(
  meta: AdsMeta,
  opts: FrequencyOpts,
  counter: InterstitialCounter = 'gameover',
): boolean {
  const cfg = opts.cfg ?? MONETIZATION.interstitial;
  const count = counterValue(meta, counter);
  if (!opts.enabled || opts.removeAds) return false;
  // Первую межстраничку откладываем до накопления общего числа завершённых
  // партий/уровней вне зависимости от режима. После первого показа cadence
  // снова определяется только локальным every-N счётчиком.
  if (meta.lastInterstitialAt === null && totalFinishedRuns(meta) < cfg.minGamesBeforeFirst) {
    return false;
  }
  if (count < cfg.everyNGameovers) return false;
  const lastFullscreen = lastFullscreenAnchor(meta);
  if (
    lastFullscreen !== null &&
    opts.nowMs - lastFullscreen < cfg.minIntervalSec * 1000
  ) {
    return false;
  }
  return true;
}

export function recordGameOver(meta: AdsMeta): AdsMeta {
  return {
    ...meta,
    gamesPlayed: meta.gamesPlayed + 1,
    adventureRunsPlayed:
      meta.adventureRunsPlayed ??
      (meta.adventureFailsSinceAd ?? 0) + (meta.adventureLevelsSinceAd ?? 0),
    adventureLevelsCompleted: meta.adventureLevelsCompleted ?? (meta.adventureLevelsSinceAd ?? 0),
    gameOversSinceAd: meta.gameOversSinceAd + 1,
    adventureFailsSinceAd: meta.adventureFailsSinceAd ?? 0,
    adventureLevelsSinceAd: meta.adventureLevelsSinceAd ?? 0,
    lastFullscreenAt: meta.lastFullscreenAt ?? meta.lastInterstitialAt ?? null,
  };
}

export function recordAdventureFail(meta: AdsMeta): AdsMeta {
  return {
    ...meta,
    adventureRunsPlayed:
      (meta.adventureRunsPlayed ??
        (meta.adventureFailsSinceAd ?? 0) + (meta.adventureLevelsSinceAd ?? 0)) + 1,
    adventureLevelsCompleted: meta.adventureLevelsCompleted ?? (meta.adventureLevelsSinceAd ?? 0),
    adventureFailsSinceAd: (meta.adventureFailsSinceAd ?? 0) + 1,
    adventureLevelsSinceAd: meta.adventureLevelsSinceAd ?? 0,
    lastFullscreenAt: meta.lastFullscreenAt ?? meta.lastInterstitialAt ?? null,
  };
}

export function recordAdventureLevelWin(meta: AdsMeta): AdsMeta {
  return {
    ...meta,
    adventureRunsPlayed:
      (meta.adventureRunsPlayed ??
        (meta.adventureFailsSinceAd ?? 0) + (meta.adventureLevelsSinceAd ?? 0)) + 1,
    adventureLevelsCompleted:
      (meta.adventureLevelsCompleted ?? (meta.adventureLevelsSinceAd ?? 0)) + 1,
    adventureFailsSinceAd: meta.adventureFailsSinceAd ?? 0,
    adventureLevelsSinceAd: (meta.adventureLevelsSinceAd ?? 0) + 1,
    lastFullscreenAt: meta.lastFullscreenAt ?? meta.lastInterstitialAt ?? null,
  };
}

export function recordFullscreenCooldown(meta: AdsMeta, nowMs: number): AdsMeta {
  return {
    ...meta,
    adventureRunsPlayed:
      meta.adventureRunsPlayed ??
      (meta.adventureFailsSinceAd ?? 0) + (meta.adventureLevelsSinceAd ?? 0),
    adventureLevelsCompleted: meta.adventureLevelsCompleted ?? (meta.adventureLevelsSinceAd ?? 0),
    adventureFailsSinceAd: meta.adventureFailsSinceAd ?? 0,
    adventureLevelsSinceAd: meta.adventureLevelsSinceAd ?? 0,
    lastFullscreenAt: nowMs,
  };
}

export function recordInterstitialShown(
  meta: AdsMeta,
  nowMs: number,
  _counter: InterstitialCounter = 'gameover',
  productSessionId?: string,
): AdsMeta {
  const sessionShows = productSessionId
    ? interstitialShowsForSession(meta, productSessionId) + 1
    : meta.interstitialShowsInSession ?? 0;
  return {
    ...meta,
    adventureRunsPlayed:
      meta.adventureRunsPlayed ??
      (meta.adventureFailsSinceAd ?? 0) + (meta.adventureLevelsSinceAd ?? 0),
    adventureLevelsCompleted: meta.adventureLevelsCompleted ?? (meta.adventureLevelsSinceAd ?? 0),
    // A fullscreen uses the same budget in every mode: old counters cannot
    // trigger another show immediately after switching to a different mode.
    gameOversSinceAd: 0,
    adventureFailsSinceAd: 0,
    adventureLevelsSinceAd: 0,
    lastFullscreenAt: nowMs,
    lastInterstitialAt: nowMs,
    interstitialSessionId: productSessionId ?? meta.interstitialSessionId ?? null,
    interstitialShowsInSession: sessionShows,
  };
}
