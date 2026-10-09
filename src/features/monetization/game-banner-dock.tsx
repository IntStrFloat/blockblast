import { View } from 'react-native';

import { AdBanner } from './AdBanner';
import type { AdBannerProps } from './AdBanner';
import { MONETIZATION } from './config';
import { useEntitlements } from './entitlements';

type GameBannerDockProps = Omit<AdBannerProps, 'placement'> & { hidden?: boolean };

export const GAME_BANNER_RESERVED_HEIGHT = 50;

export function GameBannerDock({ hidden = false, ...props }: GameBannerDockProps) {
  const removeAds = useEntitlements((state) => state.removeAds);
  const reserveBannerSpace =
    MONETIZATION.bannerEnabled && !removeAds && props.ftueComplete === true;

  return (
    <View
      testID="game-banner-dock"
      style={{
        width: '100%',
        minHeight: reserveBannerSpace ? GAME_BANNER_RESERVED_HEIGHT : 0,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {hidden ? null : <AdBanner {...props} placement="game" />}
    </View>
  );
}
