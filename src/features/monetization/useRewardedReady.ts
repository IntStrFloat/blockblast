import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAdPresentation } from './adPresentation';
import { getAds } from './index';

const RETRY_DELAYS_MS = [30_000, 60_000];

/** Prepare rewarded inventory only while a usable voluntary offer is visible. */
export function useRewardedReady(active = true): boolean {
  const [ready, setReady] = useState(() => active && getAds().isRewardedReady());

  useEffect(() => {
    if (!active) return;
    const ads = getAds();
    let mounted = true;
    let preparing = false;
    let foreground = AppState.currentState === 'active';
    let attempts = 0;
    let lastAttemptAt = -Infinity;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let wasReady = ads.isRewardedReady();
    let wasFullscreen = useAdPresentation.getState().fullscreenActive;
    const cancelRetry = () => {
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      retryTimer = undefined;
    };
    const update = () => {
      if (mounted) setReady(ads.isRewardedReady());
    };
    const canPrepare = () => mounted && foreground && !ads.isRewardedReady()
      && !useAdPresentation.getState().fullscreenActive;
    const schedule = (delayMs: number) => {
      if (!canPrepare() || retryTimer !== undefined) return;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        prepare();
      }, delayMs);
    };
    const prepare = () => {
      if (preparing || !canPrepare() || attempts > RETRY_DELAYS_MS.length) return;
      cancelRetry();
      preparing = true;
      attempts += 1;
      lastAttemptAt = Date.now();
      void (async () => {
        try {
          await (ads.prepareRewarded ? ads.prepareRewarded() : ads.init());
        } catch {
          // Readiness also covers providers that resolve after a failed SDK load.
        } finally {
          preparing = false;
          update();
          const delay = RETRY_DELAYS_MS[attempts - 1];
          if (delay !== undefined) schedule(delay);
        }
      })();
    };
    const unsubscribe = ads.subscribeRewardedReady?.(() => {
      if (!mounted) return;
      const readyNow = ads.isRewardedReady();
      const fullscreenNow = useAdPresentation.getState().fullscreenActive;
      const inventoryConsumed = wasReady && !readyNow;
      const fullscreenFinished = wasFullscreen && !fullscreenNow;
      wasReady = readyNow;
      wasFullscreen = fullscreenNow;
      update();
      if (readyNow || fullscreenNow) cancelRetry();
      if (inventoryConsumed || fullscreenFinished) {
        attempts = preparing ? 1 : 0;
        prepare();
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      const becameActive = !foreground && state === 'active';
      foreground = state === 'active';
      if (!foreground) cancelRetry();
      if (becameActive) {
        attempts = preparing ? 1 : 0;
        update();
        // Returning from background permits recovery, but rapid toggles must not
        // turn an offline offer into an unbounded stream of SDK requests.
        const remaining = RETRY_DELAYS_MS[0] - (Date.now() - lastAttemptAt);
        if (remaining > 0) schedule(remaining);
        else prepare();
      }
    });
    update();
    prepare();
    return () => {
      mounted = false;
      cancelRetry();
      unsubscribe?.();
      appStateSubscription.remove();
    };
  }, [active]);

  return active && ready;
}
