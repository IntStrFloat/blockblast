import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
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
import { claimRewardedBenefit } from '@/features/monetization/rewardedBenefits';
import { AppText, colors, radii } from '@/ui';

import { findSwapTarget } from '../logic/helpers';
import type { EmoteId } from '../logic/types';
import { canUseHelper } from '../logic/rules';
import { useMascot } from '../store';

interface HelperSwapProps {
  onEmote: (id: EmoteId) => void;
  reduceMotion: boolean;
  compact?: boolean;
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
export function HelperSwap({ onEmote, reduceMotion, compact = false }: HelperSwapProps) {
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
    const offeredEpoch = useGameStore.getState().epoch;
    try {
      const result = await claimRewardedBenefit({ kind: 'helper', helperId: 'swap' }, getAds());
      if (result === 'applied' || result === 'pending' || result === 'dismissed') {
        saveAdsMeta(recordFullscreenCooldown(loadAdsMeta(), Date.now()));
      }
      if (result === 'applied' && useGameStore.getState().epoch === offeredEpoch) {
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
      <Animated.View testID="helper-swap-undo" entering={entering} exiting={exiting} style={styles.toast}>
        <Pressable onPress={doUndo} style={styles.undoHit} accessibilityRole="button" accessibilityLabel={`${t('mascot.swapped', lang)}. ${t('mascot.undo', lang)}`}>
          <AppText preset="caption" numberOfLines={1} allowFontScaling={false} maxFontSizeMultiplier={1.2} style={[styles.toastText, { fontSize: compact ? 9 : 10 }]}>
            {t('mascot.swapped', lang)}
          </AppText>
          <AppText preset="button" numberOfLines={1} allowFontScaling={false} maxFontSizeMultiplier={1.2} style={styles.undoText}>
            {t('mascot.undo', lang)}
          </AppText>
        </Pressable>
      </Animated.View>
    );
  }

  if (resultText) {
    return (
      <Animated.View testID="helper-swap-result" entering={entering} exiting={exiting} style={styles.result}>
        <AppText preset="caption" numberOfLines={2} allowFontScaling={false} maxFontSizeMultiplier={1.2} style={[styles.resultText, { fontSize: compact ? 10 : 11 }]}>{resultText}</AppText>
      </Animated.View>
    );
  }

  if (!available) return null;

  return (
    <Animated.View entering={entering} exiting={exiting} style={styles.frame}>
      <Pressable
        testID="helper-swap"
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
          <AppText preset="button" numberOfLines={2} allowFontScaling={false} maxFontSizeMultiplier={1.2} style={[styles.label, { fontSize: compact ? 10 : 11 }]}>
            {rewardOffer
              ? `${t('mascot.swap', lang)}\n${t('mascot.adCharge', lang)}`
              : (compact ? '' : '🔄 ') + t('mascot.swap', lang) + (charges > 0 ? ' · ' + charges : '')}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', minWidth: 0 },
  hit: {
    width: '100%',
    minWidth: 0,
    minHeight: 44,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  pill: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  label: {
    lineHeight: 14,
    textAlign: 'center',
    flexShrink: 1,
    minWidth: 0,
    includeFontPadding: false,
  },
  toast: {
    width: '100%',
    minWidth: 0,
    height: 44,
    alignItems: 'center',
    borderRadius: radii.card,
    backgroundColor: colors.cardGlass,
  },
  toastText: {
    color: colors.textPrimary,
    lineHeight: 13,
    textAlign: 'center',
    flexShrink: 1,
    includeFontPadding: false,
  },
  result: {
    width: '100%',
    minWidth: 0,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  resultText: {
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
    flexShrink: 1,
    includeFontPadding: false,
  },
  undoHit: {
    width: '100%',
    minHeight: 44,
    height: 44,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  undoText: {
    color: colors.accent,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    flexShrink: 1,
    includeFontPadding: false,
  },
});
