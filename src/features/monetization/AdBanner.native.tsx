import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { BannerAdSize, BannerView } from 'yandex-mobile-ads';

import { useAnalyticsStore } from '@/features/analytics';

import { MONETIZATION } from './config';
import { useEntitlements } from './entitlements';
import { shouldShowGameBanner, shouldShowHomeBanner } from './policy';

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
  const policyEligible =
    placement === 'home'
      ? shouldShowHomeBanner()
      : shouldShowGameBanner({ ftueComplete, gamesPlayed });

  useEffect(() => {
    let active = true;
    if (!MONETIZATION.bannerEnabled || removeAds || !policyEligible) {
      return;
    }
    BannerAdSize.stickySize(width)
      .then((nextSize) => {
        if (active) {
          useAnalyticsStore
            .getState()
            .track('ad_requested', { format: 'banner', placement });
          setSize(nextSize);
        }
      })
      .catch(() => {
        if (active) setSize(null);
      });
    return () => {
      active = false;
    };
  }, [placement, policyEligible, removeAds, width]);

  if (!MONETIZATION.bannerEnabled || removeAds || !policyEligible || !size) return null;

  return (
    <View style={{ width: '100%', height: size.height, alignItems: 'center' }}>
      <BannerView
        size={size}
        adRequest={{ adUnitId }}
        onAdLoaded={() => {
          useAnalyticsStore.getState().track('ad_shown', { format: 'banner', placement });
        }}
        onAdFailedToLoad={(event) => {
          console.warn('[ads] Yandex banner failed to load', event.nativeEvent);
          useAnalyticsStore.getState().track('ad_failed', {
            format: 'banner',
            placement,
            stage: 'load',
            message: event.nativeEvent?.description,
          });
        }}
      />
    </View>
  );
}
