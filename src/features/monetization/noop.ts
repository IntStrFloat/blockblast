import { MONETIZATION } from './config';
import type { AdsProvider, IapProvider } from './types';

function fakeRewarded(): boolean {
  return MONETIZATION.fakeRewardedInDev && __DEV__;
}

export const NoopAdsProvider: AdsProvider = {
  async init() {},
  async showInterstitial() {
    return 'unavailable';
  },
  async showRewarded(_placement, onEarned) {
    if (!fakeRewarded()) return 'unavailable';
    try {
      onEarned?.();
    } catch {
      // The consumer retains the earned obligation and can retry delivery.
      console.warn('[ads] Simulated reward delivery failed');
    }
    return 'rewarded';
  },
  isRewardedReady() {
    return fakeRewarded();
  },
};

export const NoopIapProvider: IapProvider = {
  async init() {},
  async getProducts() {
    return [];
  },
  async purchase() {
    return 'failed';
  },
  async restore() {
    return [];
  },
};
