import {
  InterstitialAdLoader,
  MobileAds,
  RewardedAdLoader,
} from 'yandex-mobile-ads';
import type { InterstitialAd, RewardedAd } from 'yandex-mobile-ads';

import { MONETIZATION } from './config';
import type {
  AdsProvider,
  InterstitialResult,
  RewardedResult,
} from './types';

let interstitialAd: InterstitialAd | null = null;
let rewardedAd: RewardedAd | null = null;
let interstitialLoadPromise: Promise<void> | null = null;
let rewardedLoadPromise: Promise<void> | null = null;
let sdkInitPromise: Promise<void> | null = null;

function reportAdsError(stage: string, error: unknown): void {
  console.warn(`[ads] Yandex ${stage} failed`, error);
}

async function preloadInterstitial(): Promise<void> {
  if (interstitialAd) return;
  if (!interstitialLoadPromise) {
    interstitialLoadPromise = (async () => {
      try {
        const loader = await InterstitialAdLoader.create();
        interstitialAd = await loader.loadAd({
          adUnitId: MONETIZATION.yandex.interstitialAdUnitId,
        });
      } catch (error) {
        reportAdsError('interstitial load', error);
        interstitialAd = null;
      } finally {
        interstitialLoadPromise = null;
      }
    })();
  }
  await interstitialLoadPromise;
}

async function preloadRewarded(): Promise<void> {
  if (rewardedAd) return;
  if (!rewardedLoadPromise) {
    rewardedLoadPromise = (async () => {
      try {
        const loader = await RewardedAdLoader.create();
        rewardedAd = await loader.loadAd({
          adUnitId: MONETIZATION.yandex.rewardedAdUnitId,
        });
      } catch (error) {
        reportAdsError('rewarded load', error);
        rewardedAd = null;
      } finally {
        rewardedLoadPromise = null;
      }
    })();
  }
  await rewardedLoadPromise;
}

async function initialize(): Promise<void> {
  if (!sdkInitPromise) {
    sdkInitPromise = MobileAds.initialize().catch((error: unknown) => {
      reportAdsError('SDK initialization', error);
      sdkInitPromise = null;
    });
  }
  await sdkInitPromise;
  await Promise.all([preloadInterstitial(), preloadRewarded()]);
}

async function showInterstitial(): Promise<InterstitialResult> {
  const ad = interstitialAd;
  if (!ad) {
    void preloadInterstitial();
    return 'unavailable';
  }
  interstitialAd = null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: InterstitialResult) => {
      if (settled) return;
      settled = true;
      void preloadInterstitial();
      resolve(result);
    };

    ad.onAdDismissed = () => finish('shown');
    ad.onAdFailedToShow = (error) => {
      reportAdsError('interstitial show', error);
      finish('unavailable');
    };
    ad.show().catch((error) => {
      reportAdsError('interstitial show', error);
      finish('unavailable');
    });
  });
}

async function showRewarded(): Promise<RewardedResult> {
  const ad = rewardedAd;
  if (!ad) {
    void preloadRewarded();
    return 'unavailable';
  }
  rewardedAd = null;

  return new Promise((resolve) => {
    let settled = false;
    let earnedReward = false;
    const finish = (result: RewardedResult) => {
      if (settled) return;
      settled = true;
      void preloadRewarded();
      resolve(result);
    };

    ad.onRewarded = () => {
      earnedReward = true;
    };
    ad.onAdDismissed = () => finish(earnedReward ? 'rewarded' : 'dismissed');
    ad.onAdFailedToShow = (error) => {
      reportAdsError('rewarded show', error);
      finish('unavailable');
    };
    ad.show().catch((error) => {
      reportAdsError('rewarded show', error);
      finish('unavailable');
    });
  });
}

export const YandexAdsProvider: AdsProvider = {
  init: initialize,
  showInterstitial,
  showRewarded,
  isRewardedReady: () => rewardedAd !== null,
};
