import {
  InterstitialAdLoader,
  MobileAds,
  RewardedAdLoader,
} from 'yandex-mobile-ads';
import type { InterstitialAd, RewardedAd } from 'yandex-mobile-ads';

import { getExperimentAssignment, useAnalyticsStore } from '@/features/analytics';
import { getJSON, KEYS, setJSON } from '@/core/storage';

import { areAutomaticAdsSuppressed, suppressAutomaticAds, useAdPresentation } from './adPresentation';
import { MONETIZATION } from './config';
import { EMPTY_ADS_META, recordFullscreenCooldown } from './frequency';
import type { AdsMeta } from './frequency';
import { parseImpressionRevenue } from './revenue';
import type {
  AdsProvider,
  InterstitialTelemetry,
  InterstitialPlacement,
  InterstitialResult,
  RewardedPlacement,
  RewardedResult,
} from './types';

let interstitialAd: InterstitialAd | null = null;
let interstitialAdLoadId: string | null = null;
let rewardedAd: RewardedAd | null = null;
let rewardedAdLoadId: string | null = null;
// The SDK keeps native loaders in process storage with no public destroy API.
// Reuse them across requests instead of retaining one native loader per retry.
let interstitialLoader: InterstitialAdLoader | null = null;
let rewardedLoader: RewardedAdLoader | null = null;
let interstitialLoadPromise: Promise<void> | null = null;
let rewardedLoadPromise: Promise<void> | null = null;
let sdkInitPromise: Promise<void> | null = null;
let sdkInitialized = false;
const rewardedReadyListeners = new Set<() => void>();
let adAttemptCounter = 0;
let adLoadCounter = 0;
let fullscreenAttemptId: string | null = null;
const adAttemptProcessId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type AdFormat = 'interstitial' | 'rewarded';

function notifyRewardedReady(): void {
  for (const listener of rewardedReadyListeners) {
    try { listener(); } catch (error) { reportAdsError('readiness listener', error); }
  }
}

function nextLoadId(format: AdFormat): string {
  adLoadCounter += 1;
  return format + '-load:' + adAttemptProcessId + ':' + adLoadCounter;
}

function currentInterstitialLoadContext(): {
  experiment_id?: string;
  variant?: 'control' | 'first_session_capped';
  product_session_id?: string;
  session_depth?: number;
} {
  const context = useAnalyticsStore.getState().context;
  const assigned = getExperimentAssignment(MONETIZATION.interstitialExperiment.id);
  const variant = assigned === 'control' || assigned === 'first_session_capped'
    ? assigned
    : undefined;
  return {
    ...(variant
      ? {
          experiment_id: MONETIZATION.interstitialExperiment.id,
          variant,
        }
      : {}),
    ...(context
      ? {
          product_session_id: context.product_session_id,
          session_depth: context.session_games,
        }
      : {}),
  };
}

function nextAttemptId(format: AdFormat, placement: InterstitialPlacement | RewardedPlacement): string {
  adAttemptCounter += 1;
  return `${format}:${placement}:${adAttemptProcessId}:${adAttemptCounter}`;
}

function reportAdsError(stage: string, error: unknown): void {
  console.warn(`[ads] Yandex ${stage} failed`, error);
}

function recordImpressionCooldown(): void {
  setJSON(KEYS.adsMeta, recordFullscreenCooldown(getJSON<AdsMeta>(KEYS.adsMeta) ?? EMPTY_ADS_META, Date.now()));
}

function releaseFullscreen(attemptId: string): void {
  if (fullscreenAttemptId !== attemptId) return;
  fullscreenAttemptId = null;
  useAdPresentation.setState({ fullscreenActive: false });
  notifyRewardedReady();
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function trackAdRequested(
  format: AdFormat,
  placement: InterstitialPlacement | RewardedPlacement,
  attemptId?: string,
  telemetry?: InterstitialTelemetry,
  loadId?: string,
): void {
  useAnalyticsStore.getState().track('ad_requested', {
    format, placement, attempt_id: attemptId, ...telemetry, load_id: loadId,
  });
}

function trackAdShown(
  format: AdFormat,
  placement: InterstitialPlacement | RewardedPlacement,
  attemptId?: string,
  telemetry?: InterstitialTelemetry,
  loadId?: string,
): void {
  useAnalyticsStore.getState().track('ad_shown', {
    format, placement, attempt_id: attemptId, ...telemetry, load_id: loadId,
  });
}

function trackAdClicked(
  format: AdFormat,
  placement: InterstitialPlacement | RewardedPlacement,
  attemptId?: string,
  telemetry?: InterstitialTelemetry,
  loadId?: string,
): void {
  useAnalyticsStore.getState().track('ad_clicked', {
    format, placement, attempt_id: attemptId, ...telemetry, load_id: loadId,
  });
}

function trackAdDismissed(
  format: AdFormat,
  placement: InterstitialPlacement | RewardedPlacement,
  attemptId?: string,
  telemetry?: InterstitialTelemetry,
  loadId?: string,
): void {
  useAnalyticsStore.getState().track('ad_dismissed', {
    format, placement, attempt_id: attemptId, ...telemetry, load_id: loadId,
  });
}

function trackAdRewarded(
  placement: RewardedPlacement,
  attemptId?: string,
): void {
  useAnalyticsStore.getState().track('ad_rewarded', {
    format: 'rewarded',
    placement,
    attempt_id: attemptId,
  });
}

function trackAdFailed(
  format: AdFormat,
  placement: InterstitialPlacement | RewardedPlacement,
  stage: 'load' | 'show' | 'init',
  attemptId?: string,
  error?: unknown,
  telemetry?: InterstitialTelemetry,
  loadId?: string,
): void {
  useAnalyticsStore.getState().track('ad_failed', {
    format,
    placement,
    attempt_id: attemptId,
    stage,
    message: errorMessage(error),
    ...telemetry,
    load_id: loadId,
  });
}

function trackAdResult(
  format: AdFormat,
  placement: InterstitialPlacement | RewardedPlacement,
  attemptId: string,
  result: 'shown' | 'clicked' | 'dismissed' | 'rewarded' | 'unavailable',
  telemetry?: InterstitialTelemetry,
  loadId?: string,
): void {
  useAnalyticsStore.getState().track('ad_result', {
    format, placement, attempt_id: attemptId, result, ...telemetry, load_id: loadId,
  });
}

async function preloadInterstitial(): Promise<void> {
  if (interstitialAd) return;
  if (!interstitialLoadPromise) {
    interstitialLoadPromise = (async () => {
      const loadId = nextLoadId('interstitial');
      const loadContext = currentInterstitialLoadContext();
      useAnalyticsStore.getState().track('ad_load_requested', {
        format: 'interstitial',
        load_id: loadId,
        ...loadContext,
      });
      try {
        interstitialLoader ??= await InterstitialAdLoader.create();
        interstitialAd = await interstitialLoader.loadAd({
          adUnitId: MONETIZATION.yandex.interstitialAdUnitId,
        });
        interstitialAdLoadId = loadId;
        useAnalyticsStore.getState().track('ad_loaded', {
          format: 'interstitial',
          placement: 'preload',
          load_id: loadId,
          ...loadContext,
        });
      } catch (error) {
        reportAdsError('interstitial load', error);
        useAnalyticsStore.getState().track('ad_failed', {
          format: 'interstitial',
          placement: 'preload',
          load_id: loadId,
          stage: 'load',
          message: errorMessage(error),
          ...loadContext,
        });
        interstitialAd = null;
        interstitialAdLoadId = null;
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
      const loadId = nextLoadId('rewarded');
      useAnalyticsStore.getState().track('ad_load_requested', { format: 'rewarded', load_id: loadId });
      try {
        rewardedLoader ??= await RewardedAdLoader.create();
        rewardedAd = await rewardedLoader.loadAd({
          adUnitId: MONETIZATION.yandex.rewardedAdUnitId,
        });
        rewardedAdLoadId = loadId;
        useAnalyticsStore.getState().track('ad_loaded', { format: 'rewarded', placement: 'preload', load_id: loadId });
        notifyRewardedReady();
      } catch (error) {
        reportAdsError('rewarded load', error);
        useAnalyticsStore.getState().track('ad_failed', { format: 'rewarded', placement: 'preload', stage: 'load', load_id: loadId, message: errorMessage(error) });
        rewardedAd = null;
        rewardedAdLoadId = null;
      } finally {
        rewardedLoadPromise = null;
      }
    })();
  }
  await rewardedLoadPromise;
}

async function initialize(): Promise<void> {
  if (!sdkInitPromise) {
    sdkInitPromise = Promise.resolve().then(() => MobileAds.initialize()).then(() => {
      sdkInitialized = true;
    }).catch((error: unknown) => {
      reportAdsError('SDK initialization', error);
      trackAdFailed('interstitial', 'gameover', 'init', undefined, error);
      trackAdFailed('rewarded', 'revive', 'init', undefined, error);
      sdkInitPromise = null;
    });
  }
  await sdkInitPromise;
}

async function prepareInterstitial(): Promise<void> {
  if (fullscreenAttemptId || areAutomaticAdsSuppressed()) return;
  await initialize();
  if (sdkInitialized && !fullscreenAttemptId && !areAutomaticAdsSuppressed()) await preloadInterstitial();
}

async function prepareRewarded(): Promise<void> {
  if (fullscreenAttemptId) return;
  await initialize();
  if (sdkInitialized && !fullscreenAttemptId) await preloadRewarded();
}

async function showInterstitial(
  placement: InterstitialPlacement,
  telemetry?: InterstitialTelemetry,
  onImpression?: () => void,
): Promise<InterstitialResult> {
  const attemptId = nextAttemptId('interstitial', placement);
  const loadId = interstitialAdLoadId ?? undefined;
  trackAdRequested('interstitial', placement, attemptId, telemetry, loadId);
  const ad = interstitialAd;
  if (!ad || fullscreenAttemptId || areAutomaticAdsSuppressed()) {
    useAnalyticsStore.getState().track('ad_eligible', {
      format: 'interstitial',
      placement,
      attempt_id: attemptId,
      blocked_reason: fullscreenAttemptId ? 'fullscreen_active' : areAutomaticAdsSuppressed() ? 'rewarded_cooldown' : 'not_loaded',
      ...telemetry,
    });
    trackAdFailed('interstitial', placement, 'show', attemptId, undefined, telemetry, loadId);
    trackAdResult('interstitial', placement, attemptId, 'unavailable', telemetry, loadId);
    void prepareInterstitial();
    return 'unavailable';
  }
  interstitialAd = null;
  interstitialAdLoadId = null;
  fullscreenAttemptId = attemptId;
  useAdPresentation.setState({ fullscreenActive: true });
  notifyRewardedReady();
  useAnalyticsStore.getState().track('ad_eligible', {
    format: 'interstitial',
    placement,
    attempt_id: attemptId,
    ...telemetry,
  });

  return new Promise((resolve) => {
    let settled = false;
    let impressionReported = false;
    const finish = (result: InterstitialResult) => {
      if (settled) return;
      settled = true;
      releaseFullscreen(attemptId);
      trackAdResult(
        'interstitial',
        placement,
        attemptId,
        result === 'shown' ? 'shown' : 'unavailable',
        telemetry,
        loadId,
      );
      resolve(result);
    };

    ad.onAdImpression = (data) => {
      if (settled || impressionReported) return;
      impressionReported = true;
      recordImpressionCooldown();
      trackAdShown('interstitial', placement, attemptId, telemetry, loadId);
      const revenue = parseImpressionRevenue(data?.rawData, {
        format: 'interstitial', placement, attempt_id: attemptId,
        ad_unit_id: MONETIZATION.yandex.interstitialAdUnitId,
      });
      if (revenue) useAnalyticsStore.getState().track('ad_revenue', {
        ...revenue,
        ...telemetry,
        load_id: loadId,
      });
      try { onImpression?.(); } catch (error) { reportAdsError('impression persistence', error); }
    };
    ad.onAdDismissed = () => {
      if (settled) return;
      trackAdDismissed('interstitial', placement, attemptId, telemetry, loadId);
      finish('shown');
    };
    ad.onAdClicked = () => {
      if (settled) return;
      trackAdClicked('interstitial', placement, attemptId, telemetry, loadId);
    };
    ad.onAdFailedToShow = (error) => {
      if (settled) return;
      reportAdsError('interstitial show', error);
      trackAdFailed('interstitial', placement, 'show', attemptId, error, telemetry, loadId);
      finish('unavailable');
    };
    const failedToShow = (error: unknown) => {
      if (settled) return;
      reportAdsError('interstitial show', error);
      trackAdFailed('interstitial', placement, 'show', attemptId, error, telemetry, loadId);
      finish('unavailable');
    };
    try { void ad.show().catch(failedToShow); } catch (error) { failedToShow(error); }
  });
}

async function showRewarded(placement: RewardedPlacement, onEarned?: () => void): Promise<RewardedResult> {
  const attemptId = nextAttemptId('rewarded', placement);
  const loadId = rewardedAdLoadId ?? undefined;
  trackAdRequested('rewarded', placement, attemptId, undefined, loadId);
  const ad = rewardedAd;
  if (!ad || fullscreenAttemptId) {
    useAnalyticsStore.getState().track('ad_eligible', { format: 'rewarded', placement, attempt_id: attemptId, blocked_reason: fullscreenAttemptId ? 'fullscreen_active' : 'not_loaded' });
    trackAdFailed('rewarded', placement, 'show', attemptId, undefined, undefined, loadId);
    trackAdResult('rewarded', placement, attemptId, 'unavailable', undefined, loadId);
    return 'unavailable';
  }
  rewardedAd = null;
  rewardedAdLoadId = null;
  fullscreenAttemptId = attemptId;
  useAdPresentation.setState({ fullscreenActive: true });
  notifyRewardedReady();
  useAnalyticsStore.getState().track('ad_eligible', { format: 'rewarded', placement, attempt_id: attemptId });

  return new Promise((resolve) => {
    let settled = false;
    let earnedReward = false;
    let rewardDelivered = false;
    let impressionReported = false;
    const deliverReward = () => {
      if (!earnedReward || rewardDelivered) return;
      try {
        onEarned?.();
        rewardDelivered = true;
      } catch (error) {
        reportAdsError('reward delivery', error);
      }
    };
    const finish = (result: RewardedResult) => {
      if (settled) return;
      settled = true;
      deliverReward();
      releaseFullscreen(attemptId);
      if (impressionReported || earnedReward || result === 'dismissed') suppressAutomaticAds();
      const earnedResult = earnedReward ? 'rewarded' : result;
      trackAdResult('rewarded', placement, attemptId, earnedResult, undefined, loadId);
      resolve(earnedResult);
    };

    ad.onRewarded = () => {
      if (settled || earnedReward) return;
      earnedReward = true;
      deliverReward();
      trackAdRewarded(placement, attemptId);
    };
    ad.onAdImpression = (data) => {
      if (settled || impressionReported) return;
      impressionReported = true;
      recordImpressionCooldown();
      suppressAutomaticAds();
      trackAdShown('rewarded', placement, attemptId, undefined, loadId);
      const revenue = parseImpressionRevenue(data?.rawData, {
        format: 'rewarded', placement, attempt_id: attemptId,
        ad_unit_id: MONETIZATION.yandex.rewardedAdUnitId,
      });
      if (revenue) useAnalyticsStore.getState().track('ad_revenue', { ...revenue, load_id: loadId });
    };
    ad.onAdDismissed = () => {
      if (settled) return;
      trackAdDismissed('rewarded', placement, attemptId, undefined, loadId);
      finish(earnedReward ? 'rewarded' : 'dismissed');
    };
    ad.onAdClicked = () => {
      if (settled) return;
      trackAdClicked('rewarded', placement, attemptId, undefined, loadId);
    };
    ad.onAdFailedToShow = (error) => {
      if (settled) return;
      reportAdsError('rewarded show', error);
      trackAdFailed('rewarded', placement, 'show', attemptId, error, undefined, loadId);
      finish('unavailable');
    };
    const failedToShow = (error: unknown) => {
      if (settled) return;
      reportAdsError('rewarded show', error);
      trackAdFailed('rewarded', placement, 'show', attemptId, error, undefined, loadId);
      finish('unavailable');
    };
    try { void ad.show().catch(failedToShow); } catch (error) { failedToShow(error); }
  });
}

export const YandexAdsProvider: AdsProvider = {
  init: initialize,
  prepareInterstitial,
  prepareRewarded,
  subscribeRewardedReady: (listener) => {
    rewardedReadyListeners.add(listener);
    return () => { rewardedReadyListeners.delete(listener); };
  },
  showInterstitial,
  showRewarded,
  isRewardedReady: () => rewardedAd !== null && fullscreenAttemptId === null,
};
