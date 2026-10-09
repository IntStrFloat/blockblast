import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { useGameStore } from '@/features/game';
import type { GameState } from '@/core/engine';
import {
  getAds,
  loadAdsMeta,
  recordFullscreenCooldown,
  saveAdsMeta,
} from '@/features/monetization';
import { isHelperUnlocked, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { todayISO } from '@/features/streak';
import { useRewardedReady } from '@/features/monetization/useRewardedReady';
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

export type SwapUndoOutcome = 'undo' | 'commit' | 'noop';

export function swapUndoOutcome(
  pending: boolean,
  snapshot: GameState | null,
  postSwap: GameState | null,
  current: GameState,
): SwapUndoOutcome {
  if (!pending || !snapshot) return 'noop';
  return current === postSwap ? 'undo' : 'commit';
}

/**
 * Мягкий помощник «замена» (разлок ур.12). Чип появляется ТОЛЬКО когда в трее
 * есть непомещаемая фигура. Тап заменяет её на свежую и показывает undo-тост ~1с:
 * пока он виден, кулдаун НЕ списан — отмена бесплатна. По истечении окна своп
 * «застывает» и списывается кулдаун до завтра.
 */
export function HelperSwap({ onEmote, reduceMotion }: HelperSwapProps) {
  const board = useGameStore((s) => s.game.board);
  const tray = useGameStore((s) => s.game.tray);
  const level = useProgression((s) => s.level);
  const usedDay = useMascot((s) => s.helpersUsedDay.swap);
  const charges = useMascot((s) => s.helperCharges.swap ?? 0);
  const lang = useLang();
  const [rewardBusy, setRewardBusy] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const today = todayISO();

  // Снимок партии до свопа — для отмены. null, когда окна отмены нет.
  const [undoSnapshot, setUndoSnapshot] = useState<GameState | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const rewardInFlightRef = useRef(false);
  // Состояние партии сразу после свопа: отмена допустима, только пока партия не
  // изменилась (иначе undo затёр бы последующий ход игрока).
  const postSwapRef = useRef<GameState | null>(null);

  // На размонтировании: если своп «висит» в окне отмены — зафиксировать кулдаун
  // (ход уже сохранён в партии) и снять таймер.
  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
      if (resultTimer.current) clearTimeout(resultTimer.current);
      if (pendingRef.current) {
        useMascot.getState().useHelper('swap');
        pendingRef.current = false;
      }
    },
    [],
  );
  const target = findSwapTarget(board, tray);
  const helperUnlocked = isHelperUnlocked('swap', level);
  const freeAvailable = canUseHelper(usedDay, today, level, 'swap', charges) && target !== null;
  const canOfferRewarded = helperUnlocked && usedDay === today && charges === 0 && target !== null;
  const rewardedReady = useRewardedReady(canOfferRewarded && !rewardBusy);
  const rewardOffer = canOfferRewarded && rewardedReady && !rewardBusy;
  const available = freeAvailable || rewardOffer;
  const source = rewardOffer ? 'rewarded' : usedDay === today ? 'charge' : 'free';

  useEffect(() => {
    if (!available) return;
    const runId = useAnalyticsStore.getState().activeRun?.run_id ?? 'no-run';
    for (const stage of ['eligible', 'shown'] as const) {
      useAnalyticsStore.getState().trackOnce(
        `helper:${runId}:swap:${stage}:${today}`,
        'helper_funnel',
        { helper: 'swap', stage, source, remaining_charges: charges },
      );
    }
  }, [available, charges, source, today]);


  function doSwap() {
    const i = findSwapTarget(board, tray);
    if (i === null) return false;
    const prev = useGameStore.getState().game;
    useGameStore.getState().replaceTrayPiece(i);
    postSwapRef.current = useGameStore.getState().game;
    onEmote('sparkle');

    setUndoSnapshot(prev);
    pendingRef.current = true;
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      commitPendingSwap(true);
      commitTimer.current = null;
      setUndoSnapshot(null);
    }, UNDO_MS);
    return true;
  }

  function commitPendingSwap(showResult: boolean) {
    if (!pendingRef.current) return false;
    pendingRef.current = false;
    const used = useMascot.getState().useHelper('swap');
    if (!used) return false;
    const remaining = useMascot.getState().helperCharges.swap ?? 0;
    useAnalyticsStore.getState().track('helper_funnel', {
      helper: 'swap',
      stage: 'used',
      source,
      remaining_charges: remaining,
    });
    if (showResult) {
      setResultText(
        t('mascot.helperUsed', lang) + ' · ' + t('mascot.charges', lang) + ' ' + remaining,
      );
      if (resultTimer.current) clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(() => {
        resultTimer.current = null;
        setResultText(null);
      }, 1_800);
    }
    return true;
  }

  function doUndo() {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    const outcome = swapUndoOutcome(
      pendingRef.current,
      undoSnapshot,
      postSwapRef.current,
      useGameStore.getState().game,
    );
    if (outcome === 'undo' && undoSnapshot) {
      pendingRef.current = false;
      useGameStore.getState().restoreGame(undoSnapshot);
    } else if (outcome === 'commit') {
      commitPendingSwap(true);
    }
    postSwapRef.current = null;
    setUndoSnapshot(null);
  }

  const entering = reduceMotion ? undefined : FadeIn;
  const exiting = reduceMotion ? undefined : FadeOut;

  async function handlePress() {
    if (pendingRef.current) return;
    if (freeAvailable) {
      doSwap();
      return;
    }
    if (!rewardOffer || rewardBusy || rewardInFlightRef.current) {
      return;
    }

    rewardInFlightRef.current = true;
    setRewardBusy(true);
    try {
      const result = await getAds().showRewarded('helper_charge');
      if (result !== 'unavailable') {
        saveAdsMeta(recordFullscreenCooldown(loadAdsMeta(), Date.now()));
      }
      if (result === 'rewarded') {
        useMascot.getState().addHelperCharge('swap');
        doSwap();
      }
    } finally {
      rewardInFlightRef.current = false;
      setRewardBusy(false);
    }
  }

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

  if (resultText) {
    return (
      <Animated.View entering={entering} exiting={exiting} style={styles.result}>
        <AppText preset="caption" style={styles.resultText}>{resultText}</AppText>
      </Animated.View>
    );
  }

  if (!available) return null;

  return (
    <Animated.View entering={entering} exiting={exiting}>
      <Pressable
        onPress={() => {
          void handlePress();
        }}
        style={styles.hit}
        disabled={rewardBusy}
        accessibilityRole="button"
        accessibilityLabel={
          rewardOffer
            ? `${t('mascot.swap', lang)} ${t('mascot.adCharge', lang)}`
            : t('mascot.swap', lang)
        }
      >
        <View style={styles.pill}>
          <AppText preset="button" style={styles.label}>
            {rewardOffer
              ? `🎬 ${t('mascot.swap', lang)} · ${t('mascot.adCharge', lang)}`
              : '🔄 ' + t('mascot.swap', lang) + (charges > 0 ? ' · ' + charges : '')}
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
  result: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  resultText: {
    color: colors.textPrimary,
    fontWeight: '700',
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
