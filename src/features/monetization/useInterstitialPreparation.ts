import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAdPresentation } from './adPresentation';
import { MONETIZATION, evaluateInterstitialOpportunity, getAds, loadAdsMeta } from './index';
import type { InterstitialCounter } from './frequency';

/** Warm one eligible result before the player chooses Replay or Next. */
export function useInterstitialPreparation({
  active, counter, mode, removeAds, resultContextId, activePlayMs,
}: {
  active: boolean;
  counter: InterstitialCounter;
  mode: 'classic' | 'adventure';
  removeAds: boolean;
  resultContextId: string;
  activePlayMs?: number;
}) {
  const fullscreenActive = useAdPresentation((state) => state.fullscreenActive);
  const suppressedUntil = useAdPresentation((state) => state.automaticAdsSuppressedUntil);
  useEffect(() => {
    if (!active || removeAds || fullscreenActive || !MONETIZATION.adsEnabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;
    let preparing = false;
    const prepare = () => {
      if (timer) clearTimeout(timer);
      if (!mounted || preparing || (AppState.currentState && AppState.currentState !== 'active')) return;
      const meta = loadAdsMeta();
      const now = Date.now();
      const lastFullscreen = meta.lastFullscreenAt ?? meta.lastInterstitialAt;
      const readyAt = Math.max(suppressedUntil,
        lastFullscreen == null ? 0 : lastFullscreen + MONETIZATION.interstitial.minIntervalSec * 1_000);
      if (readyAt > now) {
        timer = setTimeout(prepare, readyAt - now + 1);
        return;
      }
      const opportunity = evaluateInterstitialOpportunity(meta,
        { enabled: MONETIZATION.adsEnabled, removeAds, nowMs: now }, counter, mode,
        { resultContextId, activePlayMs }, { recordExposure: false });
      if (!opportunity.shouldRequest) return;
      preparing = true;
      void getAds().prepareInterstitial?.().catch(() => {}).finally(() => { preparing = false; });
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (timer) clearTimeout(timer);
      if (state === 'active') prepare();
    });
    prepare();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [active, activePlayMs, counter, fullscreenActive, mode, removeAds, resultContextId, suppressedUntil]);
}
