import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useGameStore } from '@/features/game';
import type { GameState } from '@/core/engine';
import { useLang } from '@/features/settings';
import { todayISO } from '@/features/streak';
import { AppText, colors, radii, spacing } from '@/ui';

import { findSwapTarget } from '../logic/helpers';
import type { EmoteId } from '../logic/types';
import { canUseHelper } from '../logic/rules';
import { useMascot } from '../store';

interface HelperSwapProps {
  onEmote: (id: EmoteId) => void;
  reduceMotion: boolean;
}

/** Окно отмены свопа (мс): после него ход «застывает» и списывается кулдаун. */
const UNDO_MS = 1100;

/**
 * Мягкий помощник «замена» (разлок ур.12). Чип появляется ТОЛЬКО когда в трее
 * есть непомещаемая фигура. Тап заменяет её на свежую и показывает undo-тост ~1с:
 * пока он виден, кулдаун НЕ списан — отмена бесплатна. По истечении окна своп
 * «застывает» и списывается кулдаун до завтра.
 */
export function HelperSwap({ onEmote, reduceMotion }: HelperSwapProps) {
  const board = useGameStore((s) => s.game.board);
  const tray = useGameStore((s) => s.game.tray);
  const level = useMascot((s) => s.level);
  const usedDay = useMascot((s) => s.helpersUsedDay.swap);
  const lang = useLang();

  // Снимок партии до свопа — для отмены. null, когда окна отмены нет.
  const [undoSnapshot, setUndoSnapshot] = useState<GameState | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  // Состояние партии сразу после свопа: отмена допустима, только пока партия не
  // изменилась (иначе undo затёр бы последующий ход игрока).
  const postSwapRef = useRef<GameState | null>(null);

  // На размонтировании: если своп «висит» в окне отмены — зафиксировать кулдаун
  // (ход уже сохранён в партии) и снять таймер.
  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
      if (pendingRef.current) {
        useMascot.getState().useHelper('swap');
        pendingRef.current = false;
      }
    },
    [],
  );

  const target = findSwapTarget(board, tray);
  const available = canUseHelper(usedDay, todayISO(), level, 'swap') && target !== null;

  function doSwap() {
    const i = findSwapTarget(board, tray);
    if (i === null) return;
    const prev = useGameStore.getState().game;
    useGameStore.getState().replaceTrayPiece(i);
    postSwapRef.current = useGameStore.getState().game;
    onEmote('sparkle');

    setUndoSnapshot(prev);
    pendingRef.current = true;
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      useMascot.getState().useHelper('swap');
      pendingRef.current = false;
      commitTimer.current = null;
      setUndoSnapshot(null);
    }, UNDO_MS);
  }

  function doUndo() {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    pendingRef.current = false;
    // Откатываем только если с момента свопа партия не менялась.
    if (undoSnapshot && useGameStore.getState().game === postSwapRef.current) {
      useGameStore.getState().restoreGame(undoSnapshot);
    }
    postSwapRef.current = null;
    setUndoSnapshot(null);
  }

  const entering = reduceMotion ? undefined : FadeIn;
  const exiting = reduceMotion ? undefined : FadeOut;

  // Окно отмены: тост «фигуру заменили · вернуть».
  if (undoSnapshot) {
    return (
      <Animated.View entering={entering} exiting={exiting} style={styles.toast}>
        <AppText preset="caption" style={styles.toastText}>
          {t('mascot.swapped', lang)}
        </AppText>
        <Pressable onPress={doUndo} style={styles.undoHit} accessibilityRole="button">
          <AppText preset="button" style={styles.undoText}>
            {t('mascot.undo', lang)}
          </AppText>
        </Pressable>
      </Animated.View>
    );
  }

  if (!available) return null;

  return (
    <Animated.View entering={entering} exiting={exiting}>
      <Pressable
        onPress={doSwap}
        style={styles.hit}
        accessibilityRole="button"
        accessibilityLabel={t('mascot.swap', lang)}
      >
        <View style={styles.pill}>
          <AppText preset="button" style={styles.label}>
            {`🔄 ${t('mascot.swap', lang)}`}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 11,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingLeft: spacing.m,
    paddingRight: spacing.s,
    paddingVertical: 6,
    borderRadius: radii.card,
    backgroundColor: colors.cardGlass,
  },
  toastText: {
    color: colors.textPrimary,
  },
  undoHit: {
    minHeight: 36,
    paddingHorizontal: spacing.s,
    justifyContent: 'center',
  },
  undoText: {
    color: colors.accent,
    fontSize: 12,
  },
});
