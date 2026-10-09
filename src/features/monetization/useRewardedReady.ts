import { useEffect, useState } from 'react';

import { getAds } from './index';

/** Prepare rewarded inventory only while a usable voluntary offer is visible. */
export function useRewardedReady(active = true): boolean {
  const [ready, setReady] = useState(() => active && getAds().isRewardedReady());

  useEffect(() => {
    if (!active) return;
    const ads = getAds();
    let mounted = true;
    let preparing = false;
    const update = () => {
      if (mounted) setReady(ads.isRewardedReady());
    };
    const prepare = () => {
      if (preparing || !mounted || ads.isRewardedReady()) return;
      preparing = true;
      const pending = ads.prepareRewarded ? ads.prepareRewarded() : ads.init();
      void pending.catch(() => {}).finally(() => {
        preparing = false;
        update();
      });
    };
    const unsubscribe = ads.subscribeRewardedReady?.(() => {
      update();
      prepare();
    });
    update();
    prepare();
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [active]);

  return active && ready;
}
