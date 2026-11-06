import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { t } from '@/core/i18n';
import { type AnalyticsGameMode, useAnalyticsStore } from '@/features/analytics';
import { useLang } from '@/features/settings';

export type InvalidDropReason = 'occupied' | 'outside-board' | 'unavailable';

export function useInvalidDropNotice(mode: AnalyticsGameMode) {
  const lang = useLang();
  const [message, setMessage] = useState<string | null>(null);
  const occupiedStreakRef = useRef(0);
  const lastShownAtRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    const now = Date.now();
    if (now - lastShownAtRef.current < 2_500) return;
    lastShownAtRef.current = now;
    setMessage(next);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setMessage(null);
    }, 1_800);
  }, []);

  const report = useCallback((reason: InvalidDropReason, shapeId?: string) => {
    if (reason === 'occupied') occupiedStreakRef.current += 1;
    else occupiedStreakRef.current = 0;
    useAnalyticsStore.getState().track('invalid_drop', {
      mode,
      reason,
      streak: occupiedStreakRef.current,
      placement_index: useAnalyticsStore.getState().activeRun?.placements ?? 0,
      ...(shapeId ? { shape_id: shapeId } : {}),
    });
    if (reason === 'occupied' && occupiedStreakRef.current >= 2) {
      show(t('game.invalidOccupied', lang));
    } else if (reason === 'unavailable') {
      show(t('game.pieceNoSpace', lang));
    }
  }, [lang, mode, show]);

  const recordValidDrop = useCallback(() => {
    occupiedStreakRef.current = 0;
    setMessage(null);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  return useMemo(() => ({ message, report, recordValidDrop }), [message, report, recordValidDrop]);
}

/** Invalid footprints are shown on the board. Announce the guidance without a visual toast. */
export function InvalidDropNotice({ message }: { message: string | null }) {
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return null;
}
