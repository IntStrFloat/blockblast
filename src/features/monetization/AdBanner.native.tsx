import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { BannerAdSize, BannerView } from 'yandex-mobile-ads';

import { useAnalyticsStore } from '@/features/analytics';

import { useAdPresentation } from './adPresentation';
import { MONETIZATION } from './config';
import { useEntitlements } from './entitlements';
import { shouldShowGameBanner, shouldShowHomeBanner } from './policy';
import { acceptBannerRevenue, bannerImpressionRawData, parseImpressionRevenue } from './revenue';

export type AdBannerProps = {
  adUnitId?: string;
  placement?: 'home' | 'game';
  ftueComplete?: boolean;
  gamesPlayed?: number;
};

export function AdBanner({
  adUnitId = MONETIZATION.yandex.bannerAdUnitId,
  placement = 'game',
  ftueComplete = false,
  gamesPlayed = 0,
}: AdBannerProps = {}) {
  const { width } = useWindowDimensions();
  const removeAds = useEntitlements((state) => state.removeAds);
  const [size, setSize] = useState<BannerAdSize | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const seenImpressions = useRef(new Set<string>());
  const impressionSequence = useRef(0);
  const fullscreenActive = useAdPresentation((state) => state.fullscreenActive);
  const suppressedUntil = useAdPresentation((state) => state.automaticAdsSuppressedUntil);
  const [now, setNow] = useState(Date.now);
  const presentationSuppressed = fullscreenActive || suppressedUntil > now;
  useEffect(() => {
    const remaining = suppressedUntil - Date.now();
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, remaining + 1));
    return () => clearTimeout(timer);
  }, [suppressedUntil]);
  const policyEligible =
    placement === 'home'
      ? shouldShowHomeBanner()
      : shouldShowGameBanner({ ftueComplete, gamesPlayed });

  useEffect(() => {
    let active = true;
    if (!MONETIZATION.bannerEnabled || removeAds || !policyEligible || presentationSuppressed) {
      useAnalyticsStore.getState().track('ad_eligible', {
        format: 'banner',
        placement,
        blocked_reason: !MONETIZATION.bannerEnabled ? 'disabled' : removeAds ? 'entitlement' : presentationSuppressed ? 'fullscreen_cooldown' : 'frequency_policy',
      });
      return;
    }
    const nextAttemptId = `banner:${placement}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    useAnalyticsStore.getState().track('ad_eligible', { format: 'banner', placement, attempt_id: nextAttemptId });
    useAnalyticsStore
      .getState()
      .track('ad_requested', { format: 'banner', placement, attempt_id: nextAttemptId });
    attemptIdRef.current = nextAttemptId;
    BannerAdSize.stickySize(width)
      .then((nextSize) => {
        if (active) {
          setSize(nextSize);
        }
      })
      .catch(() => {
        if (active) setSize(null);
      });
    return () => {
      active = false;
    };
  }, [placement, policyEligible, presentationSuppressed, removeAds, width]);

  if (!MONETIZATION.bannerEnabled || removeAds || !policyEligible || presentationSuppressed || !size) return null;

  return (
    <View style={{ width: '100%', height: size.height, alignItems: 'center' }}>
      <BannerView
        size={size}
        adRequest={{ adUnitId }}
        onAdLoaded={() => {
          useAnalyticsStore
            .getState()
            .track('ad_loaded', {
              format: 'banner',
              placement,
              attempt_id: attemptIdRef.current ?? undefined,
            });
        }}
        onAdImpression={(event) => {
          impressionSequence.current += 1;
          const revenue = parseImpressionRevenue(bannerImpressionRawData(event.nativeEvent?.impressionData), {
            format: 'banner', placement, ad_unit_id: adUnitId,
            attempt_id: `${attemptIdRef.current}:impression:${impressionSequence.current}`,
          });
          if (revenue && !acceptBannerRevenue(revenue, seenImpressions.current)) return;
          if (revenue) useAnalyticsStore.getState().track('ad_revenue', revenue);
          useAnalyticsStore
            .getState()
            .track('ad_shown', {
              format: 'banner',
              placement,
              attempt_id: attemptIdRef.current ?? undefined,
            });
          useAnalyticsStore.getState().track('ad_result', { format: 'banner', placement, attempt_id: attemptIdRef.current ?? undefined, result: 'shown' });
        }}
        onAdClicked={() => {
          useAnalyticsStore
            .getState()
            .track('ad_clicked', {
              format: 'banner',
              placement,
              attempt_id: attemptIdRef.current ?? undefined,
            });
        }}
        onAdFailedToLoad={(event) => {
          console.warn('[ads] Yandex banner failed to load', event.nativeEvent);
          useAnalyticsStore.getState().track('ad_failed', {
            format: 'banner',
            placement,
            attempt_id: attemptIdRef.current ?? undefined,
            stage: 'load',
            message: event.nativeEvent?.description,
          });
          useAnalyticsStore.getState().track('ad_result', { format: 'banner', placement, attempt_id: attemptIdRef.current ?? undefined, result: 'failed' });
        }}
      />
    </View>
  );
}
