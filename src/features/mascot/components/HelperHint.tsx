import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { EMPTY_MASK, previewMask, useDragCtx, useGameStore } from '@/features/game';
import { useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { todayISO } from '@/features/streak';
import { AppText, colors, radii } from '@/ui';

import { MASCOT_CONFIG } from '../logic/config';
import { findHintMove, isStuckish } from '../logic/helpers';
import type { EmoteId } from '../logic/types';
import { canUseHelper } from '../logic/rules';
import { useMascot } from '../store';

interface HelperHintProps {
  onEmote: (id: EmoteId) => void;
  reduceMotion: boolean;
}

const THRESHOLD = MASCOT_CONFIG.helpers.hint.stuckThreshold;

/**
 * Мягкий помощник «подсказка» (разлок ур.5). Не мигающий чип появляется ТОЛЬКО
 * в момент реального затыка (мало валидных позиций) и пока кулдаун свободен. Тап
 * подсвечивает реальную валидную позицию ghost-блоками (переиспользует preview
 * drag-системы) — ход за игрока НЕ делается. После показа — кулдаун до завтра.
 */
export function HelperHint({ onEmote, reduceMotion }: HelperHintProps) {
  const ctx = useDragCtx();

  const board = useGameStore((s) => s.game.board);
  const tray = useGameStore((s) => s.game.tray);
  const level = useProgression((s) => s.level);
  const usedDay = useMascot((s) => s.helpersUsedDay.hint);
  const charges = useMascot((s) => s.helperCharges.hint ?? 0);
  const lang = useLang();

  // Таймер сброса подсветки — чистим на размонтировании, не читаем в рендере.
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      // Не оставлять «висящую» подсветку после анмаунта.
      ctx.preview.value = EMPTY_MASK;
      ctx.previewColor.value = 0;
    },
    [ctx.preview, ctx.previewColor],
  );

  const stuck = isStuckish(board, tray, THRESHOLD);
  const move = stuck ? findHintMove(board, tray) : null;
  const available = canUseHelper(usedDay, todayISO(), level, 'hint', charges) && move !== null;

  if (!available) return null;

  function showHint() {
    // Свежий расчёт на момент тапа (доска могла измениться).
    const m = findHintMove(board, tray);
    if (!m) return;
    const piece = tray[m.trayIndex];
    if (!piece) return;

    ctx.preview.value = previewMask(board, piece.shape.cells, m.r, m.c);
    ctx.previewColor.value = piece.colorId;
    onEmote('sparkle');

    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(
      () => {
        ctx.preview.value = EMPTY_MASK;
        ctx.previewColor.value = 0;
      },
      reduceMotion ? 1200 : 1900,
    );

    // Кулдаун списывается за сам показ подсказки.
    useMascot.getState().useHelper('hint');
  }

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn}
      exiting={reduceMotion ? undefined : FadeOut}
    >
      <Pressable
        onPress={showHint}
        style={styles.hit}
        accessibilityRole="button"
        accessibilityLabel={t('mascot.hint', lang)}
      >
        <View style={styles.pill}>
          <AppText preset="button" style={styles.label}>
            {`🐾 ${t('mascot.hint', lang)}`}
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
});
