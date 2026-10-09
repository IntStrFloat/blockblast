import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { type AnalyticsGameMode, useAnalyticsStore } from '@/features/analytics';
import { useLang } from '@/features/settings';
import { AppText } from '@/ui';

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

  return { message, report, recordValidDrop };
}

export function InvalidDropNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View
        entering={FadeIn.duration(120)}
        exiting={FadeOut.duration(100)}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={message}
        style={styles.notice}
      >
        <AppText preset="speech" style={styles.text} numberOfLines={2}>
          {message}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 170,
    zIndex: 180,
    alignItems: 'center',
  },
  notice: {
    maxWidth: 340,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    justifyContent: 'center',
    backgroundColor: 'rgba(17,39,79,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,244,199,0.72)',
  },
  text: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
  },
});
