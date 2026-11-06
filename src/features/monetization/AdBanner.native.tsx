import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { BannerAdSize, BannerView } from 'yandex-mobile-ads';

import { useAnalyticsStore } from '@/features/analytics';

import { GAME_BANNER_RESERVED_HEIGHT } from './bannerLayout';
import { useAdPresentation } from './adPresentation';
import { bannerLoadErrorMessage } from './bannerLoadError';
import { MONETIZATION } from './config';
import { useEntitlements } from './entitlements';
import { shouldShowGameBanner, shouldShowHomeBanner } from './policy';
import { acceptBannerRevenue, bannerImpressionRawData, parseImpressionRevenue } from './revenue';
import { useBannerRecovery } from './useBannerRecovery';

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
  const requestedScopeRef = useRef<string | null>(null);
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
  const bannerActive = MONETIZATION.bannerEnabled && !removeAds && policyEligible && !presentationSuppressed;
  // An inactive placement must obtain a fresh size before mounting again.
  // In particular, expiration of suppression in background cannot reuse stale size to mount.
  if (!bannerActive && size) setSize(null);
  const recovery = useBannerRecovery(bannerActive);

  useEffect(() => {
    let active = true;
    if (!MONETIZATION.bannerEnabled || removeAds || !policyEligible || presentationSuppressed) {
      requestedScopeRef.current = null;
      useAnalyticsStore.getState().track('ad_eligible', {
        format: 'banner',
        placement,
        blocked_reason: !MONETIZATION.bannerEnabled ? 'disabled' : removeAds ? 'entitlement' : presentationSuppressed ? 'fullscreen_cooldown' : 'frequency_policy',
      });
      return;
    }
    if (!recovery.foreground) return;
    const requestScope = `${placement}:${adUnitId}:${width}:${recovery.generation}`;
    if (requestedScopeRef.current === requestScope && size) return;
    (placement === 'game'
      ? BannerAdSize.inlineSize(width, GAME_BANNER_RESERVED_HEIGHT)
      : BannerAdSize.stickySize(width))
      .then((nextSize) => {
        if (active) {
          const nextAttemptId = `banner:${placement}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
          requestedScopeRef.current = requestScope;
          attemptIdRef.current = nextAttemptId;
          useAnalyticsStore.getState().track('ad_eligible', { format: 'banner', placement, attempt_id: nextAttemptId });
          useAnalyticsStore.getState().track('ad_requested', { format: 'banner', placement, attempt_id: nextAttemptId });
          setSize(nextSize);
        }
      })
      .catch(() => {
        if (active) setSize(null);
      });
    return () => {
      active = false;
    };
  }, [placement, adUnitId, policyEligible, presentationSuppressed, removeAds, width, size, recovery.generation, recovery.foreground]);

  if (!MONETIZATION.bannerEnabled || removeAds || !policyEligible || presentationSuppressed || !size) return null;

  return (
    <View style={{ width: '100%', height: size.height, alignItems: 'center' }}>
      <BannerView
        key={recovery.generation}
        size={size}
        adRequest={{ adUnitId }}
        onAdLoaded={() => {
          recovery.onLoaded();
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
          recovery.onFailed();
          console.warn('[ads] Yandex banner failed to load', event.nativeEvent);
          useAnalyticsStore.getState().track('ad_failed', {
            format: 'banner',
            placement,
            attempt_id: attemptIdRef.current ?? undefined,
            stage: 'load',
            message: bannerLoadErrorMessage(event.nativeEvent),
          });
          useAnalyticsStore.getState().track('ad_result', { format: 'banner', placement, attempt_id: attemptIdRef.current ?? undefined, result: 'failed' });
        }}
      />
    </View>
  );
}
