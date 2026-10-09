import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAnalyticsStore } from '@/features/analytics';
import { useProfileStore } from '@/features/profile';

import { adventureSeasonWindowNeedsRefresh } from '../logic/seasonWindow';
import { useAdventure } from '../store';

const BOOTSTRAP_RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000] as const;

export function useSeasonWindowRefresh(enabled = true): void {
  const authToken = useProfileStore((state) => state.authToken);
  const bootstrapRemote = useProfileStore((state) => state.bootstrapRemote);
  const bootstrapFailureRef = useRef(0);
  const bootstrapRetryAtRef = useRef(0);

  const refresh = useCallback(async (
    reason: 'focus' | 'foreground' | 'timer',
  ): Promise<void> => {
    if (!enabled) return;
    const nowMs = Date.now();
    const adventure = useAdventure.getState();
    if (!adventureSeasonWindowNeedsRefresh(
      adventure.seasonWindow,
      adventure.seasonWindowSyncedAtMs,
      nowMs,
    )) return;
    if (adventure.seasonWindow) {
      useAnalyticsStore.getState().trackOnce(
        `stale-countdown:${adventure.seasonWindow.seasonId}:${adventure.seasonWindow.windowEndIso}`,
        'stale_countdown',
        {
          reason,
          had_window: true,
          window_id: String(adventure.seasonWindow.seasonId),
        },
      );
    }
    if (!authToken && nowMs < bootstrapRetryAtRef.current) return;
    try {
      const token = authToken ?? (await bootstrapRemote())?.authToken ?? null;
      if (!token) throw new Error('profile_bootstrap_unavailable');
      bootstrapFailureRef.current = 0;
      bootstrapRetryAtRef.current = 0;
      await useAdventure.getState().syncSeasonWindow(token, { nowMs });
    } catch {
      const failureIndex = Math.min(
        bootstrapFailureRef.current,
        BOOTSTRAP_RETRY_DELAYS_MS.length - 1,
      );
      bootstrapFailureRef.current += 1;
      bootstrapRetryAtRef.current = nowMs + BOOTSTRAP_RETRY_DELAYS_MS[failureIndex];
    }
  }, [authToken, bootstrapRemote, enabled]);

  useFocusEffect(useCallback(() => {
    void refresh('focus');
    return undefined;
  }, [refresh]));

  useEffect(() => {
    const timer = setInterval(() => void refresh('timer'), 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh('foreground');
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);
}
