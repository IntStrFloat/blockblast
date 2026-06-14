import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { mascotIntro, t } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { useGameStore } from '@/features/game';
import { AppText, colors, spacing } from '@/ui';

import type { EmoteId } from '../logic/types';
import { useMascot } from '../store';
import { SpeechBubble } from './SpeechBubble';

interface MascotIntroProps {
  onEmote: (id: EmoteId) => void;
}

/**
 * Одноразовое неблокирующее интро при первом запуске: показывает 4 реплики
 * Капи, синхронизируя beat 2 с первой очисткой линии. Не перекрывает доску —
 * пузырь в pointerEvents="none", пропуск-кнопка ≥44pt.
 */
export function MascotIntro({ onEmote }: MascotIntroProps) {
  const introDone = useMascot((s) => s.introDone);

  const lang = useLang();
  const tone = useSettings((s) => s.praiseTone);

  const [beat, setBeat] = useState<0 | 1 | 2 | 3>(0);
  const [finished, setFinished] = useState(false);

  // Refs for all timers and the game-store unsubscribe fn.
  // Only read/written inside effects/handlers — never in render.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // If already done on mount (e.g. introDone was persisted), do nothing.
    if (introDone) return;

    // Helper to register a clearable timer.
    function addTimer(fn: () => void, ms: number) {
      const id = setTimeout(fn, ms);
      timersRef.current.push(id);
      return id;
    }

    // beat 0 is already visible on mount.

    // beat 1 after 1700ms.
    addTimer(() => {
      setBeat(1);
      onEmote('heart');

      // Now subscribe to game store for the first line-clear (beat 2).
      let prevEvent = useGameStore.getState().lastEvent;

      // Fallback timer (~15s) advances to beat 2 even if no clear happens.
      const fallbackId = addTimer(() => {
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
        advanceToBeat2();
      }, 15000);

      const unsub = useGameStore.subscribe((state) => {
        const event = state.lastEvent;
        if (event === prevEvent) return;
        prevEvent = event;
        if (!event) return;

        const cleared = event.clearedRows.length + event.clearedCols.length;
        if (cleared > 0) {
          // Cancel fallback and unsubscribe.
          clearTimeout(fallbackId);
          timersRef.current = timersRef.current.filter((id) => id !== fallbackId);
          if (unsubRef.current) {
            unsubRef.current();
            unsubRef.current = null;
          }
          advanceToBeat2();
        }
      });

      unsubRef.current = unsub;
    }, 1700);

    function advanceToBeat2() {
      setBeat(2);
      onEmote('sparkle');

      // beat 3 after 2000ms.
      addTimer(() => {
        setBeat(3);

        // Finish after 2400ms.
        addTimer(() => {
          useMascot.getState().markIntroDone();
          setFinished(true);
        }, 2400);
      }, 2000);
    }

    return () => {
      // Clean up all timers.
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      // Clean up subscription.
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (introDone || finished) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Bubble: non-blocking, passes touches through to gameplay. */}
      <View style={styles.bubble} pointerEvents="none">
        <SpeechBubble text={mascotIntro(beat, tone, lang)} />
      </View>

      {/* Skip caption: tappable, ≥44pt hit target. */}
      <Pressable
        style={styles.skip}
        onPress={() => useMascot.getState().markIntroDone()}
        hitSlop={8}
      >
        <AppText preset="caption" style={styles.skipText}>
          {t('mascot.introSkip', lang)}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  bubble: {
    alignItems: 'center',
  },
  skip: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    color: colors.textDim,
  },
});
