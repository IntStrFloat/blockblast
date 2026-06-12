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
  async showRewarded() {
    return fakeRewarded() ? 'rewarded' : 'unavailable';
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
